import { PolygonGeometry, SitePolygon, Site } from "@terramatch-microservices/database/entities";
import { Validator, ValidationResult } from "./validator.interface";
import { NotFoundException, InternalServerErrorException } from "@nestjs/common";
import { Transaction } from "sequelize";

interface OverlapInfo {
  polyUuid: string;
  polyName: string;
  siteName: string;
  percentage: number;
  intersectSmaller: boolean;
  intersectionArea: number; // in hectares
}

interface OverlappingValidationResult extends ValidationResult {
  extraInfo: OverlapInfo[] | null;
}

interface IntersectionQueryResult {
  targetUuid: string;
  candidateUuid: string;
  candidateName: string | null;
  siteName: string | null;
  targetArea: number;
  candidateArea: number;
  intersectionArea: number;
  intersectionLatitude: number;
}

export class OverlappingValidator implements Validator {
  async validatePolygon(polygonUuid: string): Promise<OverlappingValidationResult> {
    const projectPolygons = await this.getProjectPolygons(polygonUuid);

    if (projectPolygons == null) {
      throw new NotFoundException(`Polygon with UUID ${polygonUuid} not found or has no associated project`);
    }

    const { relatedPolygonUuids } = projectPolygons;

    if (relatedPolygonUuids.length === 0) {
      return {
        valid: true,
        extraInfo: null
      };
    }

    const intersections = await this.checkIntersections([polygonUuid], relatedPolygonUuids);
    const overlaps = this.buildOverlapInfo(intersections, polygonUuid);

    return {
      valid: overlaps.length === 0,
      extraInfo: overlaps.length > 0 ? overlaps : null
    };
  }

  private async getProjectPolygons(
    polygonUuid: string
  ): Promise<{ projectId: number; relatedPolygonUuids: string[] } | null> {
    const sitePolygon = await SitePolygon.findOne({
      where: { polygonUuid, isActive: true },
      include: [
        {
          model: Site,
          as: "site",
          required: true,
          attributes: ["projectId"]
        }
      ],
      attributes: ["polygonUuid", "siteUuid"]
    });

    if (sitePolygon?.site == null) {
      return null;
    }

    const projectId = sitePolygon.site.projectId;

    const allProjectSitePolygons = await SitePolygon.findAll({
      where: { isActive: true },
      include: [
        {
          model: Site,
          as: "site",
          required: true,
          where: { projectId },
          attributes: ["projectId"]
        }
      ],
      attributes: ["polygonUuid"]
    });

    const relatedPolygonUuids = allProjectSitePolygons
      .map(sp => sp.polygonUuid)
      .filter(uuid => uuid != null && uuid !== polygonUuid) as string[];

    return { projectId, relatedPolygonUuids };
  }

  private async checkIntersections(
    targetUuids: string[],
    candidateUuids: string[]
  ): Promise<IntersectionQueryResult[]> {
    if (PolygonGeometry.sequelize == null) {
      throw new InternalServerErrorException("PolygonGeometry model is missing sequelize connection");
    }

    if (targetUuids.length === 0 || candidateUuids.length === 0) {
      return [];
    }

    const transaction = await PolygonGeometry.sequelize.transaction({
      isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED
    });

    let shouldCommit = true;

    try {
      const bboxFilteredResults = await PolygonGeometry.checkBoundingBoxIntersections(
        targetUuids,
        candidateUuids,
        transaction
      );

      if (bboxFilteredResults.length === 0) {
        return [];
      }

      const bboxTargets = [...new Set(bboxFilteredResults.map(r => r.targetUuid))];
      const bboxCandidates = [...new Set(bboxFilteredResults.map(r => r.candidateUuid))];

      // as the area in this validator is only for information purposes
      // Using fixed 35° latitude for area conversion to avoid performance impact of ST_Centroid()
      // 35° provides balance for most planting regions

      const intersectionResults = await PolygonGeometry.checkGeometryIntersections(
        bboxTargets,
        bboxCandidates,
        transaction
      );

      return intersectionResults.filter(result => result.intersectionArea > 1e-10);
    } catch (error) {
      shouldCommit = false;
      await transaction.rollback();
      throw error;
    } finally {
      if (shouldCommit) {
        await transaction.commit();
      }
    }
  }

  private convertSquareDegreesToHectares(squareDegrees: number, latitude: number): number {
    const metersPerDegree = 111320;
    const latitudeFactor = Math.cos((latitude * Math.PI) / 180);
    const squareMeters = squareDegrees * metersPerDegree * metersPerDegree * latitudeFactor;
    return squareMeters / 10000;
  }

  private buildOverlapInfo(intersections: IntersectionQueryResult[], targetUuid: string): OverlapInfo[] {
    const targetIntersections = intersections.filter(i => i.targetUuid === targetUuid);

    return targetIntersections.map(intersection => {
      const minArea = Math.min(intersection.targetArea, intersection.candidateArea);
      const percentage = Math.round((intersection.intersectionArea / minArea) * 100 * 100) / 100;

      const intersectionAreaInHectares = this.convertSquareDegreesToHectares(
        intersection.intersectionArea,
        intersection.intersectionLatitude
      );

      return {
        polyUuid: intersection.candidateUuid,
        polyName: intersection.candidateName ?? "",
        siteName: intersection.siteName ?? "",
        percentage,
        intersectSmaller: intersection.candidateArea < intersection.targetArea,
        intersectionArea: intersectionAreaInHectares
      };
    });
  }
}

import { PolygonGeometry, Site, SitePolygon } from "@terramatch-microservices/database/entities";
import { PolygonValidationResult, ValidationResult, Validator } from "./validator.interface";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { Transaction } from "sequelize";

interface OverlapInfo {
  poly_uuid: string;
  poly_name: string;
  site_name: string;
  percentage: number;
  intersect_smaller: boolean;
  intersection_area: number;
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

  async validatePolygons(polygonUuids: string[]): Promise<PolygonValidationResult[]> {
    if (polygonUuids.length === 0) {
      return [];
    }

    const uniquePolygonUuids = [...new Set(polygonUuids)];
    if (uniquePolygonUuids.length < polygonUuids.length) {
      throw new BadRequestException(
        `OverlappingValidator received ${polygonUuids.length - uniquePolygonUuids.length} duplicate polygon UUIDs`
      );
    }

    const projectPolygonsMap = await this.getProjectPolygonsBatch(uniquePolygonUuids);
    const polygonsByProject = new Map<number, string[]>();
    const allProjectPolygonsMap = new Map<number, Set<string>>();

    for (const [polygonUuid, projectData] of projectPolygonsMap.entries()) {
      if (projectData != null) {
        const projectId = projectData.projectId;

        if (!polygonsByProject.has(projectId)) {
          polygonsByProject.set(projectId, []);
          allProjectPolygonsMap.set(projectId, new Set());
        }

        polygonsByProject.get(projectId)?.push(polygonUuid);
        const projectPolygonsSet = allProjectPolygonsMap.get(projectId);
        if (projectPolygonsSet != null) {
          projectPolygonsSet.add(polygonUuid);
          projectData.relatedPolygonUuids.forEach(uuid => projectPolygonsSet.add(uuid));
        }
      }
    }

    const allIntersections: IntersectionQueryResult[] = [];
    for (const [projectId, projectPolygonUuids] of polygonsByProject.entries()) {
      const allPolygonsInProjectSet = allProjectPolygonsMap.get(projectId);
      const allPolygonsInProject = allPolygonsInProjectSet != null ? Array.from(allPolygonsInProjectSet) : [];

      if (allPolygonsInProject.length > 1) {
        const intersections = await this.checkIntersections(projectPolygonUuids, allPolygonsInProject);

        const validIntersections = intersections.filter(
          intersection => intersection.targetUuid !== intersection.candidateUuid
        );

        allIntersections.push(...validIntersections);
      }
    }
    const results: PolygonValidationResult[] = [];
    for (const polygonUuid of uniquePolygonUuids) {
      const projectData = projectPolygonsMap.get(polygonUuid);

      if (projectData == null) {
        results.push({
          polygonUuid,
          valid: false,
          extraInfo: { error: "Polygon not found or has no associated project" }
        });
        continue;
      }

      const allPolygonsInProjectSet = allProjectPolygonsMap.get(projectData.projectId);
      const allPolygonsInProject = allPolygonsInProjectSet != null ? Array.from(allPolygonsInProjectSet) : [];
      const otherPolygonsCount = allPolygonsInProject.filter(uuid => uuid !== polygonUuid).length;

      if (otherPolygonsCount === 0) {
        results.push({
          polygonUuid,
          valid: true,
          extraInfo: null
        });
        continue;
      }

      const overlaps = this.buildOverlapInfo(allIntersections, polygonUuid);
      results.push({
        polygonUuid,
        valid: overlaps.length === 0,
        extraInfo: overlaps.length > 0 ? overlaps : null
      });
    }

    return results;
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

  private async getProjectPolygonsBatch(
    polygonUuids: string[]
  ): Promise<Map<string, { projectId: number; relatedPolygonUuids: string[] } | null>> {
    const sitePolygons = await SitePolygon.findAll({
      where: { polygonUuid: polygonUuids, isActive: true },
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

    const projectIds = [...new Set(sitePolygons.map(sp => sp.site?.projectId).filter(id => id != null))] as number[];

    if (projectIds.length === 0) {
      return new Map(polygonUuids.map(uuid => [uuid, null]));
    }
    const allProjectSitePolygons = await SitePolygon.findAll({
      where: { isActive: true },
      include: [
        {
          model: Site,
          as: "site",
          required: true,
          where: { projectId: projectIds },
          attributes: ["projectId"]
        }
      ],
      attributes: ["polygonUuid"]
    });

    const polygonsByProjectId = new Map<number, string[]>();
    for (const sp of allProjectSitePolygons) {
      const projectId = sp.site?.projectId;
      if (projectId != null && sp.polygonUuid != null) {
        if (!polygonsByProjectId.has(projectId)) {
          polygonsByProjectId.set(projectId, []);
        }
        polygonsByProjectId.get(projectId)?.push(sp.polygonUuid);
      }
    }
    const resultMap = new Map<string, { projectId: number; relatedPolygonUuids: string[] } | null>();

    for (const polygonUuid of polygonUuids) {
      const sitePolygon = sitePolygons.find(sp => sp.polygonUuid === polygonUuid);

      if (sitePolygon?.site?.projectId == null) {
        resultMap.set(polygonUuid, null);
        continue;
      }

      const projectId = sitePolygon.site.projectId;
      const allProjectPolygons = polygonsByProjectId.get(projectId) ?? [];
      const relatedPolygonUuids = allProjectPolygons.filter(uuid => uuid !== polygonUuid);

      resultMap.set(polygonUuid, { projectId, relatedPolygonUuids });
    }

    return resultMap;
  }

  private async checkIntersections(
    targetUuids: string[],
    candidateUuids: string[]
  ): Promise<IntersectionQueryResult[]> {
    if (targetUuids.length === 0 || candidateUuids.length === 0) {
      return [];
    }

    const transaction = await PolygonGeometry.sql.transaction({
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
        poly_uuid: intersection.candidateUuid,
        poly_name: intersection.candidateName ?? "",
        site_name: intersection.siteName ?? "",
        percentage,
        intersect_smaller: intersection.candidateArea < intersection.targetArea,
        intersection_area: intersectionAreaInHectares
      };
    });
  }
}

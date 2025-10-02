import { PolygonGeometry, SitePolygon, Site } from "@terramatch-microservices/database/entities";
import { Validator, ValidationResult, PolygonValidationResult } from "./validator.interface";
import { NotFoundException, InternalServerErrorException } from "@nestjs/common";
import { QueryTypes, Transaction } from "sequelize";
import { groupBy } from "lodash";

interface OverlapInfo {
  poly_uuid: string;
  poly_name: string;
  site_name: string;
  percentage: number;
  intersectSmaller: boolean;
}

interface OverlappingValidationResult extends ValidationResult {
  extraInfo: OverlapInfo[] | null;
}

interface IntersectionQueryResult {
  target_uuid: string;
  candidate_uuid: string;
  candidate_name: string;
  site_name: string;
  target_area: number;
  candidate_area: number;
  intersection_area: number;
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
    const polygonProjectMap = await this.getPolygonProjectMap(polygonUuids);

    const resultsByPolygon = new Map<string, PolygonValidationResult>();

    for (const polygonUuid of polygonUuids) {
      resultsByPolygon.set(polygonUuid, {
        polygonUuid,
        valid: false,
        extraInfo: { error: "Polygon not found or has no associated project" }
      });
    }

    const polygonsByProject = groupBy(
      Array.from(polygonProjectMap.entries()).map(([uuid, projectId]) => ({ uuid, projectId })),
      "projectId"
    );

    for (const [projectId, polygons] of Object.entries(polygonsByProject)) {
      const targetUuids = polygons.map(p => p.uuid);
      const allProjectPolygons = await this.getProjectPolygonsByProjectId(parseInt(projectId));

      const candidateUuids = allProjectPolygons.filter(uuid => !targetUuids.includes(uuid));

      if (candidateUuids.length === 0) {
        for (const polygon of polygons) {
          resultsByPolygon.set(polygon.uuid, {
            polygonUuid: polygon.uuid,
            valid: true,
            extraInfo: null
          });
        }
        continue;
      }

      const intersections = await this.checkIntersections(targetUuids, candidateUuids);

      for (const polygon of polygons) {
        const overlaps = this.buildOverlapInfo(intersections, polygon.uuid);
        resultsByPolygon.set(polygon.uuid, {
          polygonUuid: polygon.uuid,
          valid: overlaps.length === 0,
          extraInfo: overlaps.length > 0 ? overlaps : null
        });
      }
    }

    return Array.from(resultsByPolygon.values());
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

    if (sitePolygon == null || sitePolygon.site == null) {
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

  private async getPolygonProjectMap(polygonUuids: string[]): Promise<Map<string, number>> {
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
      attributes: ["polygonUuid"]
    });

    const map = new Map<string, number>();
    for (const sp of sitePolygons) {
      if (sp.site != null && sp.polygonUuid != null) {
        map.set(sp.polygonUuid, sp.site.projectId);
      }
    }

    return map;
  }

  private async getProjectPolygonsByProjectId(projectId: number): Promise<string[]> {
    const sitePolygons = await SitePolygon.findAll({
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

    return sitePolygons.map(sp => sp.polygonUuid).filter(uuid => uuid != null) as string[];
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

    try {
      const bboxFilteredResults = (await PolygonGeometry.sequelize.query(
        `
        SELECT DISTINCT
          target.uuid as target_uuid,
          candidate.uuid as candidate_uuid
        FROM polygon_geometry target
        CROSS JOIN polygon_geometry candidate
        WHERE target.uuid IN (:targetUuids)
          AND candidate.uuid IN (:candidateUuids)
          AND ST_Intersects(ST_Envelope(target.geom), ST_Envelope(candidate.geom))
        `,
        {
          replacements: { targetUuids, candidateUuids },
          type: QueryTypes.SELECT,
          transaction
        }
      )) as { target_uuid: string; candidate_uuid: string }[];

      if (bboxFilteredResults.length === 0) {
        await transaction.commit();
        return [];
      }

      const bboxTargets = [...new Set(bboxFilteredResults.map(r => r.target_uuid))];
      const bboxCandidates = [...new Set(bboxFilteredResults.map(r => r.candidate_uuid))];

      const intersectionResults = (await PolygonGeometry.sequelize.query(
        `
        SELECT 
          target.uuid as target_uuid,
          candidate.uuid as candidate_uuid,
          sp.poly_name as candidate_name,
          s.name as site_name,
          ST_Area(target.geom) as target_area,
          ST_Area(candidate.geom) as candidate_area,
          ST_Area(ST_Intersection(target.geom, candidate.geom)) as intersection_area
        FROM polygon_geometry target
        CROSS JOIN polygon_geometry candidate
        LEFT JOIN site_polygon sp ON sp.poly_id = candidate.uuid AND sp.is_active = 1
        LEFT JOIN v2_sites s ON s.uuid = sp.site_id
        WHERE target.uuid IN (:bboxTargets)
          AND candidate.uuid IN (:bboxCandidates)
          AND ST_Intersects(target.geom, candidate.geom)
        `,
        {
          replacements: { bboxTargets, bboxCandidates },
          type: QueryTypes.SELECT,
          transaction
        }
      )) as IntersectionQueryResult[];

      await transaction.commit();

      return intersectionResults.filter(result => result.intersection_area > 1e-10);
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  private buildOverlapInfo(intersections: IntersectionQueryResult[], targetUuid: string): OverlapInfo[] {
    const targetIntersections = intersections.filter(i => i.target_uuid === targetUuid);

    return targetIntersections.map(intersection => {
      const minArea = Math.min(intersection.target_area, intersection.candidate_area);
      const percentage = minArea > 0 ? Math.round((intersection.intersection_area / minArea) * 100 * 100) / 100 : 100;

      return {
        poly_uuid: intersection.candidate_uuid,
        poly_name: intersection.candidate_name ?? "",
        site_name: intersection.site_name ?? "",
        percentage,
        intersectSmaller: intersection.candidate_area < intersection.target_area
      };
    });
  }
}

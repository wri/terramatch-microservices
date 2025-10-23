import { PolygonGeometry, SitePolygon, Site } from "@terramatch-microservices/database/entities";
import { Validator, ValidationResult, PolygonValidationResult } from "./validator.interface";
import { NotFoundException, InternalServerErrorException, BadRequestException } from "@nestjs/common";
import { Transaction, QueryTypes } from "sequelize";
import { Feature } from "@terramatch-microservices/database/constants";

interface DuplicateInfo {
  poly_uuid: string;
  poly_name: string;
  site_name: string;
}

interface DuplicateValidationResult extends ValidationResult {
  extraInfo: DuplicateInfo[] | null;
}

interface DuplicateCheckResult {
  index: number;
  existing_uuid: string;
}

export class DuplicateGeometryValidator implements Validator {
  async validatePolygon(polygonUuid: string): Promise<DuplicateValidationResult> {
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
      throw new NotFoundException(`Site polygon with UUID ${polygonUuid} not found or has no associated project`);
    }

    const projectId = sitePolygon.site.projectId;

    const relatedPolygonUuids = await this.getProjectPolygonUuids(projectId, polygonUuid);

    if (relatedPolygonUuids.length === 0) {
      return {
        valid: true,
        extraInfo: null
      };
    }

    const duplicates = await this.checkGeometryDuplicates(polygonUuid, relatedPolygonUuids);

    return {
      valid: duplicates.length === 0,
      extraInfo: duplicates.length > 0 ? duplicates : null
    };
  }

  async validatePolygons(polygonUuids: string[]): Promise<PolygonValidationResult[]> {
    if (polygonUuids.length === 0) {
      return [];
    }

    const uniquePolygonUuids = [...new Set(polygonUuids)];
    if (uniquePolygonUuids.length < polygonUuids.length) {
      throw new BadRequestException(
        `DuplicateGeometryValidator received ${polygonUuids.length - uniquePolygonUuids.length} duplicate polygon UUIDs`
      );
    }

    const results: PolygonValidationResult[] = [];

    for (const polygonUuid of uniquePolygonUuids) {
      try {
        const validationResult = await this.validatePolygon(polygonUuid);
        results.push({
          polygonUuid,
          valid: validationResult.valid,
          extraInfo: validationResult.extraInfo
        });
      } catch (error) {
        results.push({
          polygonUuid,
          valid: false,
          extraInfo: { error: error instanceof Error ? error.message : "Unknown error" }
        });
      }
    }

    return results;
  }

  /**
   * Check for duplicate geometries in new features (used during site polygon creation)
   * This method is specifically designed to be called during the creation process
   */
  async checkNewFeaturesDuplicates(
    features: Feature[],
    siteId: string
  ): Promise<{ valid: boolean; duplicates: DuplicateCheckResult[] }> {
    if (!Array.isArray(features) || features.length === 0) {
      return { valid: true, duplicates: [] };
    }

    const sitePolygon = await SitePolygon.findOne({
      where: { siteUuid: siteId, isActive: true },
      include: [
        {
          model: Site,
          as: "site",
          required: true,
          attributes: ["projectId"]
        }
      ]
    });

    if (sitePolygon?.site == null) {
      return { valid: true, duplicates: [] };
    }

    const projectId = sitePolygon.site.projectId;
    const existingPolygonUuids = await this.getProjectPolygonUuids(projectId);

    if (existingPolygonUuids.length === 0) {
      return { valid: true, duplicates: [] };
    }

    const firstGeometryType = features[0]?.geometry?.type;
    if (firstGeometryType === "Point") {
      return this.checkNewPointsDuplicates(features, sitePolygon);
    }

    return this.checkNewPolygonsDuplicates(features, existingPolygonUuids);
  }

  private async getProjectPolygonUuids(projectId: number, excludeUuid?: string): Promise<string[]> {
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

    return sitePolygons.map(sp => sp.polygonUuid).filter(uuid => uuid != null && uuid !== excludeUuid) as string[];
  }

  private async checkGeometryDuplicates(targetUuid: string, candidateUuids: string[]): Promise<DuplicateInfo[]> {
    if (PolygonGeometry.sequelize == null) {
      throw new InternalServerErrorException("PolygonGeometry model is missing sequelize connection");
    }

    if (candidateUuids.length === 0) {
      return [];
    }

    const transaction = await PolygonGeometry.sequelize.transaction({
      isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED
    });

    try {
      const bboxFilteredResults = (await PolygonGeometry.sequelize.query(
        `
          SELECT candidate.uuid as candidateUuid
          FROM polygon_geometry target
          CROSS JOIN polygon_geometry candidate
          WHERE target.uuid = :targetUuid
            AND candidate.uuid IN (:candidateUuids)
            AND ST_Intersects(ST_Envelope(target.geom), ST_Envelope(candidate.geom))
        `,
        {
          replacements: { targetUuid, candidateUuids },
          type: QueryTypes.SELECT,
          transaction
        }
      )) as { candidateUuid: string }[];

      if (bboxFilteredResults.length === 0) {
        await transaction.commit();
        return [];
      }

      const bboxFilteredUuids = bboxFilteredResults.map(r => r.candidateUuid);

      const duplicateResults = (await PolygonGeometry.sequelize.query(
        `
          SELECT 
            candidate.uuid as candidateUuid,
            sp.poly_name as polyName,
            s.name as siteName
          FROM polygon_geometry target
          CROSS JOIN polygon_geometry candidate
          LEFT JOIN site_polygon sp ON sp.poly_id = candidate.uuid AND sp.is_active = 1
          LEFT JOIN v2_sites s ON s.uuid = sp.site_id
          WHERE target.uuid = :targetUuid
            AND candidate.uuid IN (:bboxFilteredUuids)
            AND ST_Equals(target.geom, candidate.geom)
        `,
        {
          replacements: { targetUuid, bboxFilteredUuids },
          type: QueryTypes.SELECT,
          transaction
        }
      )) as { candidateUuid: string; polyName: string; siteName: string }[];

      await transaction.commit();

      return duplicateResults.map(result => ({
        poly_uuid: result.candidateUuid,
        poly_name: result.polyName ?? "",
        site_name: result.siteName ?? ""
      }));
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  private async checkNewPolygonsDuplicates(
    features: Feature[],
    existingPolygonUuids: string[]
  ): Promise<{ valid: boolean; duplicates: DuplicateCheckResult[] }> {
    if (features.length === 0 || existingPolygonUuids.length === 0) {
      return { valid: true, duplicates: [] };
    }

    const geometryParams: string[] = [];
    const indexMap: number[] = [];

    for (let i = 0; i < features.length; i++) {
      const feature = features[i];
      if (feature?.geometry != null) {
        const geomJson = JSON.stringify(feature.geometry);
        geometryParams.push(geomJson);
        indexMap.push(i);
      }
    }

    if (geometryParams.length === 0) {
      return { valid: true, duplicates: [] };
    }

    const unionParts: string[] = [];
    const allParams: string[] = [];

    for (let i = 0; i < geometryParams.length; i++) {
      unionParts.push(`SELECT ${indexMap[i]} as idx, ST_GeomFromGeoJSON(?) as geom`);
      allParams.push(geometryParams[i]);
    }

    const existingPlaceholders = existingPolygonUuids.map(() => "?").join(",");
    allParams.push(...existingPolygonUuids);

    const sql = `
      SELECT DISTINCT ng.idx, pg.uuid as existing_uuid
      FROM (
        ${unionParts.join(" UNION ALL ")}
      ) ng
      INNER JOIN polygon_geometry pg ON pg.uuid IN (${existingPlaceholders})
      WHERE ST_Intersects(ST_Envelope(ng.geom), ST_Envelope(pg.geom))
      AND ST_Equals(ng.geom, pg.geom)
    `;

    try {
      if (PolygonGeometry.sequelize == null) {
        throw new InternalServerErrorException("PolygonGeometry model is missing sequelize connection");
      }

      const results = (await PolygonGeometry.sequelize.query(sql, {
        replacements: allParams,
        type: QueryTypes.SELECT
      })) as { idx: number; existing_uuid: string }[];

      const duplicates = results.map(row => ({
        index: row.idx,
        existing_uuid: row.existing_uuid
      }));

      return {
        valid: duplicates.length === 0,
        duplicates
      };
    } catch {
      return { valid: true, duplicates: [] };
    }
  }

  private async checkNewPointsDuplicates(
    features: Feature[],
    sitePolygon: SitePolygon
  ): Promise<{ valid: boolean; duplicates: DuplicateCheckResult[] }> {
    const projectId = sitePolygon.site?.projectId;
    if (projectId == null) {
      return { valid: true, duplicates: [] };
    }

    // Get all sites in the project
    const projectSites = await Site.findAll({
      where: { projectId },
      attributes: ["uuid"]
    });

    const projectSiteIds = projectSites.map(s => s.uuid);
    if (projectSiteIds.length === 0) {
      return { valid: true, duplicates: [] };
    }

    const geometryParams: string[] = [];
    const indexMap: number[] = [];

    for (let i = 0; i < features.length; i++) {
      const feature = features[i];
      if (feature?.geometry != null) {
        const geomJson = JSON.stringify(feature.geometry);
        geometryParams.push(geomJson);
        indexMap.push(i);
      }
    }

    if (geometryParams.length === 0) {
      return { valid: true, duplicates: [] };
    }

    const unionParts: string[] = [];
    const allParams: string[] = [];

    for (let i = 0; i < geometryParams.length; i++) {
      unionParts.push(`SELECT ${indexMap[i]} as idx, ST_GeomFromGeoJSON(?) as geom`);
      allParams.push(geometryParams[i]);
    }

    const sitePlaceholders = projectSiteIds.map(() => "?").join(",");
    allParams.push(...projectSiteIds);

    const sql = `
      SELECT DISTINCT ng.idx, sp.poly_id as existing_uuid
      FROM (
        ${unionParts.join(" UNION ALL ")}
      ) ng
      INNER JOIN point_geometry pg ON ST_Equals(ng.geom, pg.geom)
      INNER JOIN site_polygon sp ON sp.point_id = pg.uuid
      WHERE sp.site_id IN (${sitePlaceholders})
    `;

    try {
      if (PolygonGeometry.sequelize == null) {
        throw new InternalServerErrorException("PolygonGeometry model is missing sequelize connection");
      }

      const results = (await PolygonGeometry.sequelize.query(sql, {
        replacements: allParams,
        type: QueryTypes.SELECT
      })) as { idx: number; existing_uuid: string }[];

      const duplicates = results.map(row => ({
        index: row.idx,
        existing_uuid: row.existing_uuid
      }));

      return {
        valid: duplicates.length === 0,
        duplicates
      };
    } catch {
      return { valid: true, duplicates: [] };
    }
  }
}

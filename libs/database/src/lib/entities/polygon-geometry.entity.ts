import { AllowNull, AutoIncrement, Column, ForeignKey, Index, Model, PrimaryKey, Table } from "sequelize-typescript";
import { BIGINT, GEOMETRY, UUID, UUIDV4, QueryTypes, Transaction } from "sequelize";
import { Polygon } from "geojson";
import { User } from "./user.entity";
import { InternalServerErrorException } from "@nestjs/common";
import { Subquery } from "../util/subquery.builder";

@Table({ tableName: "polygon_geometry", underscored: true, paranoid: true })
export class PolygonGeometry extends Model<PolygonGeometry> {
  static async checkIsSimple(polygonUuid: string): Promise<boolean | undefined> {
    if (this.sequelize == null) {
      throw new InternalServerErrorException("PolygonGeometry model is missing sequelize connection");
    }

    const result = (await this.sequelize.query(
      `
        SELECT ST_IsSimple(geom) as isSimple
        FROM polygon_geometry 
        WHERE uuid = :polygonUuid
      `,
      {
        replacements: { polygonUuid },
        type: QueryTypes.SELECT
      }
    )) as { isSimple: boolean }[];

    return result[0]?.isSimple;
  }

  static async checkIsSimpleBatch(polygonUuids: string[]): Promise<{ uuid: string; isSimple: boolean }[]> {
    if (this.sequelize == null) {
      throw new InternalServerErrorException("PolygonGeometry model is missing sequelize connection");
    }

    return (await this.sequelize.query(
      `
        SELECT uuid, ST_IsSimple(geom) as isSimple
        FROM polygon_geometry 
        WHERE uuid IN (:polygonUuids)
      `,
      {
        replacements: { polygonUuids },
        type: QueryTypes.SELECT
      }
    )) as { uuid: string; isSimple: boolean }[];
  }

  static async getGeoJSON(polygonUuid: string): Promise<string | undefined> {
    if (this.sequelize == null) {
      throw new InternalServerErrorException("PolygonGeometry model is missing sequelize connection");
    }

    const result = (await this.sequelize.query(
      `
        SELECT ST_AsGeoJSON(geom) as geoJson
        FROM polygon_geometry 
        WHERE uuid = :polygonUuid
      `,
      {
        replacements: { polygonUuid },
        type: QueryTypes.SELECT
      }
    )) as { geoJson: string }[];

    return result[0]?.geoJson;
  }

  static async getGeoJSONBatch(polygonUuids: string[]): Promise<{ uuid: string; geoJson: string }[]> {
    if (this.sequelize == null) {
      throw new InternalServerErrorException("PolygonGeometry model is missing sequelize connection");
    }

    return (await this.sequelize.query(
      `
        SELECT uuid, ST_AsGeoJSON(geom) as geoJson
        FROM polygon_geometry 
        WHERE uuid IN (:polygonUuids)
      `,
      {
        replacements: { polygonUuids },
        type: QueryTypes.SELECT
      }
    )) as { uuid: string; geoJson: string }[];
  }

  static async getGeoJSONParsed(polygonUuid: string): Promise<Polygon | undefined> {
    const geoJsonString = await this.getGeoJSON(polygonUuid);
    if (geoJsonString == null) {
      return undefined;
    }
    return JSON.parse(geoJsonString) as Polygon;
  }

  static async getGeoJSONBatchParsed(polygonUuids: string[]): Promise<{ uuid: string; geoJson: Polygon }[]> {
    const results = await this.getGeoJSONBatch(polygonUuids);
    return results
      .map(r => ({ uuid: r.uuid, geoJson: JSON.parse(r.geoJson) as Polygon }))
      .filter(r => r.geoJson != null);
  }

  static async checkBoundingBoxIntersections(
    targetUuids: string[],
    candidateUuids: string[],
    transaction?: Transaction
  ): Promise<{ targetUuid: string; candidateUuid: string }[]> {
    if (this.sequelize == null) {
      throw new InternalServerErrorException("PolygonGeometry model is missing sequelize connection");
    }

    if (targetUuids.length === 0 || candidateUuids.length === 0) {
      return [];
    }

    return (await this.sequelize.query(
      `
        SELECT DISTINCT
          target.uuid as targetUuid,
          candidate.uuid as candidateUuid
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
    )) as { targetUuid: string; candidateUuid: string }[];
  }

  static async checkGeometryIntersections(
    targetUuids: string[],
    candidateUuids: string[],
    transaction?: Transaction
  ): Promise<
    {
      targetUuid: string;
      candidateUuid: string;
      candidateName: string | null;
      siteName: string | null;
      targetArea: number;
      candidateArea: number;
      intersectionArea: number;
      intersectionLatitude: number;
    }[]
  > {
    if (this.sequelize == null) {
      throw new InternalServerErrorException("PolygonGeometry model is missing sequelize connection");
    }

    if (targetUuids.length === 0 || candidateUuids.length === 0) {
      return [];
    }

    return (await this.sequelize.query(
      `
        SELECT 
          target.uuid as targetUuid,
          candidate.uuid as candidateUuid,
          sp.poly_name as candidateName,
          s.name as siteName,
          ST_Area(target.geom) as targetArea,
          ST_Area(candidate.geom) as candidateArea,
          ST_Area(ST_Intersection(target.geom, candidate.geom)) as intersectionArea,
          35.0 as intersectionLatitude
        FROM polygon_geometry target
        CROSS JOIN polygon_geometry candidate
        LEFT JOIN site_polygon sp ON sp.poly_id = candidate.uuid AND sp.is_active = 1
        LEFT JOIN v2_sites s ON s.uuid = sp.site_id
        WHERE target.uuid IN (:targetUuids)
          AND candidate.uuid IN (:candidateUuids)
          AND ST_Intersects(target.geom, candidate.geom)
      `,
      {
        replacements: { targetUuids, candidateUuids },
        type: QueryTypes.SELECT,
        transaction
      }
    )) as {
      targetUuid: string;
      candidateUuid: string;
      candidateName: string;
      siteName: string;
      targetArea: number;
      candidateArea: number;
      intersectionArea: number;
      intersectionLatitude: number;
    }[];
  }

  static async checkWithinCountryIntersection(
    polygonUuid: string,
    transaction?: Transaction
  ): Promise<{
    polygonArea: number;
    intersectionArea: number;
    country: string;
  } | null> {
    if (this.sequelize == null) {
      throw new InternalServerErrorException("PolygonGeometry model is missing sequelize connection");
    }

    const results = (await this.sequelize.query(
      `
        SELECT 
          ST_Area(pg.geom) as "polygonArea",
          ST_Area(ST_Intersection(pg.geom, wcg.geometry)) as "intersectionArea",
          wcg.country
        FROM polygon_geometry pg
        JOIN site_polygon sp ON sp.poly_id = pg.uuid AND sp.is_active = 1
        JOIN v2_sites s ON s.uuid = sp.site_id
        JOIN v2_projects p ON p.id = s.project_id
        JOIN world_countries_generalized wcg ON wcg.iso = p.country
        WHERE pg.uuid = :polygonUuid
          AND ST_Area(pg.geom) > 0
          AND ST_Intersects(pg.geom, wcg.geometry)
      `,
      {
        replacements: { polygonUuid },
        type: QueryTypes.SELECT,
        transaction
      }
    )) as {
      polygonArea: number;
      intersectionArea: number;
      country: string;
    }[];

    return results.length > 0 ? results[0] : null;
  }

  static async checkWithinCountryIntersectionBatch(
    polygonUuids: string[],
    transaction?: Transaction
  ): Promise<
    {
      polygonUuid: string;
      polygonArea: number;
      intersectionArea: number;
      country: string;
    }[]
  > {
    if (this.sequelize == null) {
      throw new InternalServerErrorException("PolygonGeometry model is missing sequelize connection");
    }

    if (polygonUuids.length === 0) {
      return [];
    }

    return (await this.sequelize.query(
      `
        SELECT 
          pg.uuid as polygonUuid,
          ST_Area(pg.geom) as "polygonArea",
          ST_Area(ST_Intersection(pg.geom, wcg.geometry)) as "intersectionArea",
          p.country
        FROM polygon_geometry pg
        JOIN site_polygon sp ON sp.poly_id = pg.uuid AND sp.is_active = 1
        JOIN v2_sites s ON s.uuid = sp.site_id
        JOIN v2_projects p ON p.id = s.project_id
        JOIN world_countries_generalized wcg ON wcg.iso = p.country
        WHERE pg.uuid IN (:polygonUuids)
          AND ST_Area(pg.geom) > 0
          AND ST_Intersects(pg.geom, wcg.geometry)
      `,
      {
        replacements: { polygonUuids },
        type: QueryTypes.SELECT,
        transaction
      }
    )) as {
      polygonUuid: string;
      polygonArea: number;
      intersectionArea: number;
      country: string;
    }[];
  }

  static async getProjectCountriesBatch(
    polygonUuids: string[],
    transaction?: Transaction
  ): Promise<Map<string, string>> {
    if (this.sequelize == null) {
      throw new InternalServerErrorException("PolygonGeometry model is missing sequelize connection");
    }

    if (polygonUuids.length === 0) {
      return new Map();
    }

    const results = (await this.sequelize.query(
      `
        SELECT 
          pg.uuid as polygonUuid,
          p.country
        FROM polygon_geometry pg
        JOIN site_polygon sp ON sp.poly_id = pg.uuid AND sp.is_active = 1
        JOIN v2_sites s ON s.uuid = sp.site_id
        JOIN v2_projects p ON p.id = s.project_id
        WHERE pg.uuid IN (:polygonUuids)
      `,
      {
        replacements: { polygonUuids },
        type: QueryTypes.SELECT,
        transaction
      }
    )) as { polygonUuid: string; country: string }[];

    return new Map(results.map(r => [r.polygonUuid, r.country]));
  }

  static async calculateArea(geometry: { type: string; coordinates: number[][][] | number[][][][] }): Promise<number> {
    if (this.sequelize == null) {
      throw new InternalServerErrorException("PolygonGeometry model is missing sequelize connection");
    }

    try {
      const geojson = JSON.stringify(geometry);

      const result = (await this.sequelize.query(
        `
        SELECT 
          ST_Area(ST_GeomFromGeoJSON(?)) * 
          POW(6378137 * PI() / 180, 2) * 
          COS(RADIANS(ST_Y(ST_Centroid(ST_GeomFromGeoJSON(?))))) / 10000 as area_hectares
      `,
        {
          replacements: [geojson, geojson],
          type: QueryTypes.SELECT
        }
      )) as { area_hectares: number }[];

      return parseFloat(String(result[0].area_hectares));
    } catch {
      throw new InternalServerErrorException("Area calculation failed");
    }
  }

  static async batchCalculateAreas(
    geometries: { type: string; coordinates: number[][][] | number[][][][] }[]
  ): Promise<{ area: number }[]> {
    if (geometries.length === 0) {
      return [];
    }

    if (this.sequelize == null) {
      throw new InternalServerErrorException("PolygonGeometry model is missing sequelize connection");
    }

    try {
      const geoJsonStrings = geometries.map(geom => JSON.stringify(geom));

      const sqlCases = geoJsonStrings
        .map((_, index) => `SELECT :geom${index} as geoJson, ${index} as idx`)
        .join(" UNION ALL ");

      const replacements: Record<string, string> = {};
      geoJsonStrings.forEach((geoJsonStr, index) => {
        replacements[`geom${index}`] = geoJsonStr;
      });

      const query = `
        WITH geom_data AS (
          ${sqlCases}
        )
        SELECT 
          idx,
          ST_Area(ST_GeomFromGeoJSON(geoJson)) * 
          POW(6378137 * PI() / 180, 2) * 
          COS(RADIANS(ST_Y(ST_Centroid(ST_GeomFromGeoJSON(geoJson))))) / 10000 as area_hectares
        FROM geom_data
        ORDER BY idx
      `;

      const results = (await this.sequelize.query(query, {
        replacements,
        type: QueryTypes.SELECT
      })) as { area_hectares: number }[];

      return results.map(result => ({
        area: parseFloat(String(result.area_hectares)) ?? 0
      }));
    } catch {
      throw new InternalServerErrorException("Batch area calculation failed");
    }
  }

  static uuidSubquery(uuid: string) {
    return Subquery.select(PolygonGeometry, "uuid").eq("uuid", uuid).literal;
  }

  @PrimaryKey
  @AutoIncrement
  @Column(BIGINT.UNSIGNED)
  override id: number;

  @Index
  @Column({ type: UUID, defaultValue: UUIDV4 })
  uuid: string;

  @AllowNull
  @Column({ type: GEOMETRY, field: "geom" })
  polygon: Polygon;

  @ForeignKey(() => User)
  @AllowNull
  @Column(BIGINT.UNSIGNED)
  createdBy: number | null;
}

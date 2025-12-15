import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException
} from "@nestjs/common";
import {
  PolygonGeometry,
  Project,
  Site,
  SitePolygon,
  SitePolygonData
} from "@terramatch-microservices/database/entities";
import { Feature, FeatureCollection, Geometry } from "geojson";
import { GeoJsonQueryDto } from "./dto/geojson-query.dto";
import { isNotNull } from "@terramatch-microservices/database/types/array";
import { Op } from "sequelize";

@Injectable()
export class GeoJsonExportService {
  private readonly logger = new Logger(GeoJsonExportService.name);

  async getGeoJson(query: GeoJsonQueryDto): Promise<FeatureCollection> {
    const providedParams = [query.uuid, query.siteUuid, query.projectUuid].filter(isNotNull);

    if (providedParams.length !== 1) {
      throw new BadRequestException("Exactly one of uuid, siteUuid, or projectUuid must be provided");
    }

    const includeExtendedData = query.includeExtendedData ?? true;
    const geometryOnly = query.geometryOnly ?? false;

    let features: Feature[];
    if (query.uuid != null) {
      features = await this.getSinglePolygonGeoJson(query.uuid, includeExtendedData, geometryOnly);
    } else if (query.siteUuid != null) {
      features = await this.getSitePolygonsGeoJson(query.siteUuid, includeExtendedData);
    } else if (query.projectUuid != null) {
      features = await this.getProjectPolygonsGeoJson(query.projectUuid, includeExtendedData);
    } else {
      throw new BadRequestException("Exactly one of uuid, siteUuid, or projectUuid must be provided");
    }

    return {
      type: "FeatureCollection",
      features
    };
  }

  private async getSinglePolygonGeoJson(
    polygonUuid: string,
    includeExtendedData: boolean,
    geometryOnly: boolean
  ): Promise<Feature[]> {
    const geoJsonString = await PolygonGeometry.getGeoJSON(polygonUuid);
    if (geoJsonString == null) {
      throw new NotFoundException(`Polygon geometry not found for uuid: ${polygonUuid}`);
    }

    let geometry: Geometry;
    try {
      geometry = JSON.parse(geoJsonString) as Geometry;
    } catch (error) {
      throw new InternalServerErrorException(
        `Failed to parse geometry JSON: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    if (geometryOnly) {
      return [
        {
          type: "Feature",
          geometry,
          properties: null
        }
      ];
    }

    const sitePolygon = await SitePolygon.findOne({
      where: { polygonUuid },
      include: [{ model: Site, attributes: ["uuid", "name"] }]
    });

    if (sitePolygon == null) {
      throw new NotFoundException(`Site polygon not found for polygon uuid: ${polygonUuid}`);
    }

    let extendedData: Record<string, unknown> | null = null;
    if (includeExtendedData) {
      extendedData = await this.getExtendedDataForSitePolygon(sitePolygon.uuid);
    }

    const properties = this.buildProperties(sitePolygon, includeExtendedData, extendedData);

    return [
      {
        type: "Feature",
        geometry,
        properties
      }
    ];
  }

  private async getSitePolygonsGeoJson(siteUuid: string, includeExtendedData: boolean): Promise<Feature[]> {
    const sitePolygons = await SitePolygon.findAll({
      where: { siteUuid, isActive: true },
      include: [{ model: Site, attributes: ["uuid", "name"] }]
    });

    if (sitePolygons.length === 0) {
      const site = await Site.findOne({ where: { uuid: siteUuid } });
      if (site == null) {
        throw new NotFoundException(`Site not found for uuid: ${siteUuid}`);
      }
      return [];
    }

    const polygonUuids = sitePolygons.map(sp => sp.polygonUuid).filter(isNotNull);

    if (polygonUuids.length === 0) {
      return [];
    }

    const geometryResults = await PolygonGeometry.getGeoJSONBatch(polygonUuids);
    const geometryMap = new Map<string, Geometry>();
    for (const result of geometryResults) {
      try {
        const geometry = JSON.parse(result.geoJson) as Geometry;
        geometryMap.set(result.uuid, geometry);
      } catch (error) {
        this.logger.error(`Failed to parse geometry JSON for polygon uuid: ${result.uuid}`, `${error}`);
        continue;
      }
    }

    const sitePolygonUuids = sitePolygons.map(sp => sp.uuid);
    let extendedDataMap: Map<string, Record<string, unknown>> | null = null;
    if (includeExtendedData) {
      const extendedDataRecords = await SitePolygonData.findAll({
        where: { sitePolygonUuid: sitePolygonUuids }
      });
      extendedDataMap = new Map();
      for (const record of extendedDataRecords) {
        if (record.data != null) {
          extendedDataMap.set(record.sitePolygonUuid, record.data as Record<string, unknown>);
        }
      }
    }

    const features: Feature[] = [];
    for (const sitePolygon of sitePolygons) {
      if (sitePolygon.polygonUuid == null) {
        continue;
      }

      const geometry = geometryMap.get(sitePolygon.polygonUuid);
      if (geometry == null) {
        continue;
      }

      const properties = this.buildProperties(sitePolygon, includeExtendedData, null, extendedDataMap);

      features.push({
        type: "Feature",
        geometry,
        properties
      });
    }

    return features;
  }

  private async getProjectPolygonsGeoJson(projectUuid: string, includeExtendedData: boolean): Promise<Feature[]> {
    const project = await Project.findOne({
      where: { uuid: projectUuid },
      attributes: ["id", "uuid"]
    });

    if (project == null) {
      throw new NotFoundException(`Project not found for uuid: ${projectUuid}`);
    }

    const sites = await Site.findAll({
      where: { projectId: project.id },
      attributes: ["uuid"]
    });

    if (sites.length === 0) {
      return [];
    }

    const siteUuids = sites.map(site => site.uuid);

    const sitePolygons = await SitePolygon.findAll({
      where: {
        siteUuid: { [Op.in]: siteUuids },
        isActive: true
      },
      include: [{ model: Site, attributes: ["uuid", "name"] }]
    });

    if (sitePolygons.length === 0) {
      return [];
    }

    const polygonUuids = sitePolygons.map(sp => sp.polygonUuid).filter(isNotNull);

    if (polygonUuids.length === 0) {
      return [];
    }

    const geometryResults = await PolygonGeometry.getGeoJSONBatch(polygonUuids);
    const geometryMap = new Map<string, Geometry>();
    for (const result of geometryResults) {
      try {
        const geometry = JSON.parse(result.geoJson) as Geometry;
        geometryMap.set(result.uuid, geometry);
      } catch (error) {
        this.logger.error(`Failed to parse geometry JSON for polygon uuid: ${result.uuid}`, `${error}`);
        continue;
      }
    }

    const sitePolygonUuids = sitePolygons.map(sp => sp.uuid);
    let extendedDataMap: Map<string, Record<string, unknown>> | null = null;
    if (includeExtendedData) {
      const extendedDataRecords = await SitePolygonData.findAll({
        where: { sitePolygonUuid: sitePolygonUuids }
      });
      extendedDataMap = new Map();
      for (const record of extendedDataRecords) {
        if (record.data != null) {
          extendedDataMap.set(record.sitePolygonUuid, record.data as Record<string, unknown>);
        }
      }
    }

    const features: Feature[] = [];
    for (const sitePolygon of sitePolygons) {
      if (sitePolygon.polygonUuid == null) {
        continue;
      }

      const geometry = geometryMap.get(sitePolygon.polygonUuid);
      if (geometry == null) {
        continue;
      }

      const properties = this.buildProperties(sitePolygon, includeExtendedData, null, extendedDataMap);

      features.push({
        type: "Feature",
        geometry,
        properties
      });
    }

    return features;
  }

  private buildProperties(
    sitePolygon: SitePolygon,
    includeExtendedData: boolean,
    extendedData?: Record<string, unknown> | null,
    extendedDataMap?: Map<string, Record<string, unknown>> | null
  ): Record<string, unknown> {
    const properties: Record<string, unknown> = {
      uuid: sitePolygon.uuid,
      polyName: sitePolygon.polyName ?? null,
      plantStart: sitePolygon.plantStart ?? null,
      practice: sitePolygon.practice ?? null,
      targetSys: sitePolygon.targetSys ?? null,
      distr: sitePolygon.distr ?? null,
      numTrees: sitePolygon.numTrees ?? null,
      siteId: sitePolygon.siteUuid ?? null
    };

    if (includeExtendedData) {
      let dataToMerge: Record<string, unknown> | null = null;

      if (extendedData != null) {
        dataToMerge = extendedData;
      } else if (extendedDataMap != null) {
        dataToMerge = extendedDataMap.get(sitePolygon.uuid) ?? null;
      }

      if (dataToMerge != null) {
        Object.assign(properties, dataToMerge);
      }
    }

    return properties;
  }

  private async getExtendedDataForSitePolygon(sitePolygonUuid: string): Promise<Record<string, unknown> | null> {
    const sitePolygonData = await SitePolygonData.findOne({
      where: { sitePolygonUuid }
    });

    if (sitePolygonData == null || sitePolygonData.data == null) {
      return null;
    }

    return sitePolygonData.data as Record<string, unknown>;
  }
}

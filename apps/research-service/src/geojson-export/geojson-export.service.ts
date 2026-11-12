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
import { FrameworkKey, PPC } from "@terramatch-microservices/database/constants";
import { Feature, FeatureCollection, Geometry } from "geojson";
import { GeoJsonQueryDto } from "./dto/geojson-query.dto";
import { isNotNull } from "@terramatch-microservices/database/types/array";
import { Includeable, Op } from "sequelize";
import { CustomAttributeMap, PolygonAttributeValuesService } from "../site-polygons/polygon-attribute-values.service";
import { GeoJsonExportAttributes } from "./dto/geojson-export-request.dto";
import { GEOJSON_EXPORT_SITE_ATTRIBUTES, GeoJsonExportQueryBuilder } from "./geojson-export-query.builder";
import { batchFindAll } from "@terramatch-microservices/common/util/batch-find-all";
import { once } from "events";
import { uniq } from "lodash";

const EXPORT_BATCH_SIZE = 500;

const writeChunk = async (destination: NodeJS.WritableStream, chunk: string) => {
  if (!destination.write(chunk)) await once(destination, "drain");
};

@Injectable()
export class GeoJsonExportService {
  private readonly logger = new Logger(GeoJsonExportService.name);

  constructor(private readonly polygonAttributeValuesService: PolygonAttributeValuesService) {}

  private siteIncludeForGeoJson(): Includeable[] {
    return [{ model: Site, attributes: GEOJSON_EXPORT_SITE_ATTRIBUTES }];
  }

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
          properties: {}
        }
      ];
    }

    const sitePolygon = await SitePolygon.findOne({
      where: { polygonUuid, isActive: true },
      include: this.siteIncludeForGeoJson()
    });

    if (sitePolygon == null) {
      throw new NotFoundException(`Site polygon not found for polygon uuid: ${polygonUuid}`);
    }

    let extendedData: Record<string, unknown> | null = null;
    if (includeExtendedData) {
      extendedData = await this.getExtendedDataForSitePolygon(sitePolygon.uuid);
    }

    const { keysByFramework, valuesByUuid } = await this.loadCustomAttributeExportContext([sitePolygon]);
    const properties = this.buildProperties(
      sitePolygon,
      includeExtendedData,
      extendedData,
      undefined,
      keysByFramework,
      valuesByUuid
    );

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
      include: this.siteIncludeForGeoJson()
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
      }
    }

    const extendedDataMap = includeExtendedData ? await this.loadExtendedDataMap(sitePolygons) : null;

    const { keysByFramework, valuesByUuid } = await this.loadCustomAttributeExportContext(sitePolygons);

    const features: Feature[] = [];
    for (const sitePolygon of sitePolygons) {
      if (sitePolygon.polygonUuid == null) {
        continue;
      }

      const geometry = geometryMap.get(sitePolygon.polygonUuid);
      if (geometry == null) {
        continue;
      }

      const properties = this.buildProperties(
        sitePolygon,
        includeExtendedData,
        null,
        extendedDataMap,
        keysByFramework,
        valuesByUuid
      );

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
      include: this.siteIncludeForGeoJson()
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
      }
    }

    const extendedDataMap = includeExtendedData ? await this.loadExtendedDataMap(sitePolygons) : null;

    const { keysByFramework, valuesByUuid } = await this.loadCustomAttributeExportContext(sitePolygons);

    const features: Feature[] = [];
    for (const sitePolygon of sitePolygons) {
      if (sitePolygon.polygonUuid == null) {
        continue;
      }

      const geometry = geometryMap.get(sitePolygon.polygonUuid);
      if (geometry == null) {
        continue;
      }

      const properties = this.buildProperties(
        sitePolygon,
        includeExtendedData,
        null,
        extendedDataMap,
        keysByFramework,
        valuesByUuid
      );

      features.push({
        type: "Feature",
        geometry,
        properties
      });
    }

    return features;
  }

  /**
   * Validates an export scope and resolves the name used for the delayed job and the file.
   */
  async getExportTarget({
    projectUuids,
    siteUuids,
    polygonUuids
  }: GeoJsonExportAttributes): Promise<{ entityName: string; entityType?: string }> {
    if ([projectUuids, siteUuids, polygonUuids].filter(isNotNull).length !== 1) {
      throw new BadRequestException("Exactly one of projectUuids, siteUuids or polygonUuids must be provided");
    }

    if (projectUuids != null) {
      const uuids = uniq(projectUuids);
      const projects = await Project.findAll({ where: { uuid: uuids }, attributes: ["name"] });
      if (projects.length !== uuids.length) throw new NotFoundException("One or more projects were not found");
      return {
        entityName: projects.length === 1 ? (projects[0].name ?? "Project") : `${projects.length} projects`,
        entityType: Project.LARAVEL_TYPE
      };
    }

    if (siteUuids != null) {
      const uuids = uniq(siteUuids);
      const sites = await Site.findAll({ where: { uuid: uuids }, attributes: ["name"] });
      if (sites.length !== uuids.length) throw new NotFoundException("One or more sites were not found");
      return {
        entityName: sites.length === 1 ? (sites[0].name ?? "Site") : `${sites.length} sites`,
        entityType: Site.LARAVEL_TYPE
      };
    }

    return { entityName: `${uniq(polygonUuids).length} selected` };
  }

  /**
   * Streams a GeoJSON FeatureCollection for the requested scope to the destination in batches, so
   * memory stays bounded by the batch size instead of the size of the project. Geometry JSON from
   * the DB is written as-is instead of being parsed and re-serialized.
   */
  async writeFeatureCollection(
    destination: NodeJS.WritableStream,
    { projectUuids, siteUuids, polygonUuids }: GeoJsonExportAttributes,
    onProgress: (processed: number, total: number) => Promise<void>
  ) {
    const builder = new GeoJsonExportQueryBuilder(EXPORT_BATCH_SIZE);
    if (projectUuids != null) await builder.filterProjectUuids(projectUuids);
    if (siteUuids != null) await builder.filterSiteUuids(siteUuids);
    if (polygonUuids != null) await builder.filterPolygonUuids(polygonUuids);

    const total = await builder.paginationTotal();
    await onProgress(0, total);

    await writeChunk(destination, '{"type":"FeatureCollection","features":[');
    let processed = 0;
    let written = 0;
    for await (const sitePolygons of batchFindAll(builder)) {
      const features = await this.buildFeatureJson(sitePolygons);
      if (features.length > 0) {
        await writeChunk(destination, `${written > 0 ? "," : ""}${features.join(",")}`);
        written += features.length;
      }
      processed += sitePolygons.length;
      await onProgress(processed, total);
    }
    await writeChunk(destination, "]}");
  }

  private async buildFeatureJson(sitePolygons: SitePolygon[]) {
    const polygonUuids = sitePolygons.map(({ polygonUuid }) => polygonUuid).filter(isNotNull);
    if (polygonUuids.length === 0) return [];

    const geometries = new Map(
      (await PolygonGeometry.getGeoJSONBatch(polygonUuids)).map(({ uuid, geoJson }) => [uuid, geoJson])
    );
    const extendedDataMap = await this.loadExtendedDataMap(sitePolygons);
    const { keysByFramework, valuesByUuid } = await this.loadCustomAttributeExportContext(sitePolygons);

    return sitePolygons.flatMap(sitePolygon => {
      const geometry = sitePolygon.polygonUuid == null ? undefined : geometries.get(sitePolygon.polygonUuid);
      if (geometry == null) return [];

      const properties = this.buildProperties(sitePolygon, true, null, extendedDataMap, keysByFramework, valuesByUuid);
      return [`{"type":"Feature","geometry":${geometry},"properties":${JSON.stringify(properties)}}`];
    });
  }

  private async loadExtendedDataMap(sitePolygons: SitePolygon[]) {
    const records = await SitePolygonData.findAll({
      where: { sitePolygonUuid: sitePolygons.map(({ uuid }) => uuid) },
      attributes: ["sitePolygonUuid", "data"]
    });
    const extendedDataMap = new Map<string, Record<string, unknown>>();
    for (const { sitePolygonUuid, data } of records) {
      if (data != null) extendedDataMap.set(sitePolygonUuid, data as Record<string, unknown>);
    }
    return extendedDataMap;
  }

  private async loadCustomAttributeExportContext(sitePolygons: SitePolygon[]): Promise<{
    keysByFramework: Map<FrameworkKey, string[]>;
    valuesByUuid: Map<string, CustomAttributeMap>;
  }> {
    const frameworkKeys = sitePolygons.map(sitePolygon => sitePolygon.site?.frameworkKey);
    const keysByFramework = await this.polygonAttributeValuesService.getActiveKeysByFrameworkKeys(frameworkKeys);
    const valuesByUuid = await this.polygonAttributeValuesService.getMapsByPolygonUuids(
      sitePolygons.map(sitePolygon => sitePolygon.uuid)
    );
    return { keysByFramework, valuesByUuid };
  }

  private buildProperties(
    sitePolygon: SitePolygon,
    includeExtendedData: boolean,
    extendedData?: Record<string, unknown> | null,
    extendedDataMap?: Map<string, Record<string, unknown>> | null,
    keysByFramework?: Map<FrameworkKey, string[]>,
    valuesByUuid?: Map<string, CustomAttributeMap>
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

    const site = sitePolygon.site;
    if (site?.frameworkKey === PPC) {
      properties.ppcExternalId = site.ppcExternalId ?? null;
    }

    const frameworkKey = site?.frameworkKey;
    if (frameworkKey != null && keysByFramework != null) {
      const configuredKeys = keysByFramework.get(frameworkKey) ?? [];
      const stored = valuesByUuid?.get(sitePolygon.uuid) ?? {};
      for (const key of configuredKeys) {
        properties[key] = stored[key] ?? null;
      }
    }

    if (includeExtendedData) {
      const extraAttributes = extendedData ?? extendedDataMap?.get(sitePolygon.uuid) ?? null;
      properties.extraAttributes = extraAttributes == null ? null : JSON.stringify(extraAttributes);
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

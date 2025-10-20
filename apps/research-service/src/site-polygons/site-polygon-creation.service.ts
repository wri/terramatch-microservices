import { Injectable, Logger, BadRequestException } from "@nestjs/common";
import { Site, SitePolygon, PolygonGeometry } from "@terramatch-microservices/database/entities";
import { Transaction } from "sequelize";
import { v4 as uuidv4 } from "uuid";
import { CreateSitePolygonBatchRequestDto, Feature } from "./dto/create-site-polygon-request.dto";
import { PolygonGeometryCreationService } from "./polygon-geometry-creation.service";

interface DuplicateCheckResult {
  duplicateIndexToUuid: Map<number, string>;
}

const CHUNK_SIZE = 500;
const LARGE_BATCH_THRESHOLD = 1000;
const SOURCE_GREENHOUSE = "greenhouse";

@Injectable()
export class SitePolygonCreationService {
  private readonly logger = new Logger(SitePolygonCreationService.name);

  constructor(private readonly polygonGeometryService: PolygonGeometryCreationService) {}

  /**
   * Create site polygons from batch request
   * Main entry point for polygon creation
   * Returns array of created SitePolygon models
   */
  async createSitePolygons(request: CreateSitePolygonBatchRequestDto, userId: number): Promise<SitePolygon[]> {
    return await this.storeAndValidateGeometries(request.geometries, userId);
  }

  /**
   * Store and validate geometries - main processing logic
   * Follows V2 pattern: group by site, then by type, check duplicates, create polygons
   * Returns array of created SitePolygon models
   */
  private async storeAndValidateGeometries(
    geometries: { type: string; features: Feature[] }[],
    userId: number
  ): Promise<SitePolygon[]> {
    if (PolygonGeometry.sequelize == null) {
      throw new BadRequestException("Database connection not available");
    }

    const transaction = await PolygonGeometry.sequelize.transaction();
    const allCreatedSitePolygons: SitePolygon[] = [];
    const allPolygonUuids: string[] = [];

    try {
      const groupedBySite = this.groupGeometriesBySiteId(geometries);

      await this.validateSitesExist(Object.keys(groupedBySite), transaction);

      for (const [siteId, siteGeometries] of Object.entries(groupedBySite)) {
        const groupedByType = this.groupGeometriesByType(siteGeometries);

        for (const [, typeFeatures] of Object.entries(groupedByType)) {
          const { duplicateIndexToUuid } = await this.checkDuplicates(typeFeatures, siteId, transaction);

          const { filteredFeatures } = this.filterDuplicates(typeFeatures, duplicateIndexToUuid);

          let createdSitePolygons: SitePolygon[];
          if (filteredFeatures.length > 0) {
            if (filteredFeatures.length > LARGE_BATCH_THRESHOLD) {
              createdSitePolygons = await this.processLargeGeometryBatch(filteredFeatures, siteId, userId, transaction);
            } else {
              createdSitePolygons = await this.createPolygonsBatch(filteredFeatures, siteId, userId, transaction);
            }

            allCreatedSitePolygons.push(...createdSitePolygons);
            allPolygonUuids.push(
              ...createdSitePolygons.map(sp => sp.polygonUuid).filter((u): u is string => u != null)
            );
          }
        }
      }

      if (allPolygonUuids.length > 0) {
        await this.polygonGeometryService.bulkUpdateSitePolygonCentroids(allPolygonUuids, transaction);
      }

      await transaction.commit();

      if (allPolygonUuids.length > 0) {
        this.queueIndicatorAnalysis(allPolygonUuids).catch(error => {
          this.logger.error("Failed to queue indicator analysis", error);
        });
      }

      return allCreatedSitePolygons;
    } catch (error) {
      await transaction.rollback();
      this.logger.error("Error creating site polygons", error);
      throw error;
    }
  }

  private groupGeometriesBySiteId(geometries: { features: Feature[] }[]): { [siteId: string]: Feature[] } {
    const grouped: { [siteId: string]: Feature[] } = {};

    for (const geometryCollection of geometries) {
      if (geometryCollection.features == null) {
        this.logger.warn("No features found in geometry collection");
        continue;
      }

      for (const feature of geometryCollection.features) {
        const siteId = feature.properties.site_id;
        if (siteId == null) {
          throw new BadRequestException("All features must have site_id in properties");
        }

        if (grouped[siteId] == null) {
          grouped[siteId] = [];
        }

        grouped[siteId].push(feature);
      }
    }

    return grouped;
  }

  private groupGeometriesByType(features: Feature[]): { [type: string]: Feature[] } {
    const grouped: { [type: string]: Feature[] } = {};

    for (const feature of features) {
      const geometryType = feature.geometry.type;

      if (grouped[geometryType] == null) {
        grouped[geometryType] = [];
      }

      grouped[geometryType].push(feature);
    }

    return grouped;
  }

  private async validateSitesExist(siteUuids: string[], transaction: Transaction): Promise<void> {
    const sites = await Site.findAll({
      where: { uuid: siteUuids },
      attributes: ["uuid"],
      transaction
    });

    const foundSiteUuids = new Set(sites.map(s => s.uuid));
    const missingSites = siteUuids.filter(uuid => !foundSiteUuids.has(uuid));

    if (missingSites.length > 0) {
      throw new BadRequestException(`Sites not found: ${missingSites.join(", ")}`);
    }
  }

  /**
   * Check for duplicate geometries
   * TODO: Implement actual duplicate geometry checking using PostGIS ST_Equals
   * For now, returns empty results
   */
  private async checkDuplicates(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    features: Feature[],
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    siteId: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    transaction: Transaction
  ): Promise<DuplicateCheckResult> {
    // Placeholder for duplicate checking
    // V2 implementation uses DuplicateGeometry::checkNewFeaturesDuplicates
    // which compares geometry using ST_Equals

    return {
      duplicateIndexToUuid: new Map()
    };
  }

  /**
   * Filter out duplicate features
   */
  private filterDuplicates(
    features: Feature[],
    duplicateIndexToUuid: Map<number, string>
  ): { filteredFeatures: Feature[]; filteredIndexOrder: number[] } {
    const filteredFeatures: Feature[] = [];
    const filteredIndexOrder: number[] = [];

    features.forEach((feature, index) => {
      if (!duplicateIndexToUuid.has(index)) {
        filteredFeatures.push(feature);
        filteredIndexOrder.push(index);
      }
    });

    return { filteredFeatures, filteredIndexOrder };
  }

  private async processLargeGeometryBatch(
    features: Feature[],
    siteId: string,
    userId: number,
    transaction: Transaction
  ): Promise<SitePolygon[]> {
    const allSitePolygons: SitePolygon[] = [];

    for (let i = 0; i < features.length; i += CHUNK_SIZE) {
      const chunk = features.slice(i, i + CHUNK_SIZE);
      const chunkSitePolygons = await this.createPolygonsBatch(chunk, siteId, userId, transaction);
      allSitePolygons.push(...chunkSitePolygons);
    }

    return allSitePolygons;
  }

  private async createPolygonsBatch(
    features: Feature[],
    siteId: string,
    userId: number,
    transaction: Transaction
  ): Promise<SitePolygon[]> {
    // Extract geometries from features
    const geometries = features.map(f => f.geometry);

    // Create polygon geometries
    const { uuids: polygonUuids, areas } = await this.polygonGeometryService.createGeometriesFromFeatures(
      geometries,
      userId,
      transaction
    );

    return await this.createSitePolygonRecords(features, polygonUuids, areas, siteId, userId, transaction);
  }

  private async createSitePolygonRecords(
    features: Feature[],
    polygonUuids: string[],
    areas: number[],
    siteId: string,
    userId: number,
    transaction: Transaction
  ): Promise<SitePolygon[]> {
    const sitePolygons: Partial<SitePolygon>[] = [];
    let polygonIndex = 0;

    for (let i = 0; i < features.length; i++) {
      const feature = features[i];
      const geometry = feature.geometry;
      const properties = feature.properties;

      // For MultiPolygon, we create multiple site_polygon records
      const numPolygons = geometry.type === "MultiPolygon" ? (geometry.coordinates as number[][][][]).length : 1;

      for (let j = 0; j < numPolygons; j++) {
        const primaryUuid = uuidv4();

        sitePolygons.push({
          uuid: uuidv4(),
          primaryUuid,
          siteUuid: siteId,
          polygonUuid: polygonUuids[polygonIndex],
          polyName: properties.poly_name ?? null,
          plantStart: properties.plantstart != null ? new Date(properties.plantstart) : null,
          practice: properties.practice ?? null,
          targetSys: properties.target_sys ?? null,
          distr: properties.distr ?? null,
          numTrees: properties.num_trees ?? null,
          calcArea: areas[polygonIndex],
          source: SOURCE_GREENHOUSE,
          createdBy: userId,
          isActive: true,
          status: null
        });

        polygonIndex++;
      }
    }

    return await SitePolygon.bulkCreate(sitePolygons as SitePolygon[], { transaction });
  }
}

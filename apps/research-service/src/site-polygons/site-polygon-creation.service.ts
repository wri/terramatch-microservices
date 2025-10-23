import { Injectable, Logger, BadRequestException } from "@nestjs/common";
import { Site, SitePolygon, PolygonGeometry, SitePolygonData } from "@terramatch-microservices/database/entities";
import { Transaction } from "sequelize";
import { v4 as uuidv4 } from "uuid";
import { CreateSitePolygonBatchRequestDto, Feature } from "./dto/create-site-polygon-request.dto";
import { PolygonGeometryCreationService } from "./polygon-geometry-creation.service";
import { validateSitePolygonProperties, extractAdditionalData } from "./utils/site-polygon-property-validator";
import { DuplicateGeometryValidator } from "../validations/validators/duplicate-geometry.validator";
import { ValidationCriteriaDto } from "../validations/dto/validation-criteria.dto";

interface DuplicateCheckResult {
  duplicateIndexToUuid: Map<number, string>;
}

interface ValidationIncludedData {
  type: "validation";
  id: string;
  attributes: ValidationCriteriaDto;
}

const CHUNK_SIZE = 500;
const LARGE_BATCH_THRESHOLD = 1000;
const SOURCE_GREENHOUSE = "greenhouse";

@Injectable()
export class SitePolygonCreationService {
  private readonly logger = new Logger(SitePolygonCreationService.name);

  constructor(
    private readonly polygonGeometryService: PolygonGeometryCreationService,
    private readonly duplicateGeometryValidator: DuplicateGeometryValidator
  ) {}

  async createSitePolygons(
    request: CreateSitePolygonBatchRequestDto,
    userId: number
  ): Promise<{
    data: SitePolygon[];
    included: ValidationIncludedData[];
  }> {
    const { createdPolygons, duplicatePolygons, duplicateValidations } = await this.storeAndValidateGeometries(
      request.geometries,
      userId
    );

    // Combine created and duplicate polygons in the response
    const allPolygons = [...createdPolygons, ...duplicatePolygons];

    return {
      data: allPolygons,
      included: duplicateValidations
    };
  }

  private async storeAndValidateGeometries(
    geometries: { type: string; features: Feature[] }[],
    userId: number
  ): Promise<{
    createdPolygons: SitePolygon[];
    duplicatePolygons: SitePolygon[];
    duplicateValidations: ValidationIncludedData[];
  }> {
    if (PolygonGeometry.sequelize == null) {
      throw new BadRequestException("Database connection not available");
    }

    const transaction = await PolygonGeometry.sequelize.transaction();
    const allCreatedSitePolygons: SitePolygon[] = [];
    const allDuplicatePolygons: SitePolygon[] = [];
    const allPolygonUuids: string[] = [];
    const duplicateValidations: ValidationIncludedData[] = [];

    try {
      const groupedBySite = this.groupGeometriesBySiteId(geometries);

      await this.validateSitesExist(Object.keys(groupedBySite), transaction);

      for (const [siteId, siteGeometries] of Object.entries(groupedBySite)) {
        const groupedByType = this.groupGeometriesByType(siteGeometries);

        for (const [, typeFeatures] of Object.entries(groupedByType)) {
          const { duplicateIndexToUuid } = await this.checkDuplicates(typeFeatures, siteId);
          this.logger.debug(`🔍 DUPLICATE_CHECK: Found ${duplicateIndexToUuid.size} duplicates for site ${siteId}`);

          // Collect validation data for duplicates found and fetch existing duplicate polygons
          const existingDuplicateUuids: string[] = [];
          for (const [, existingUuid] of duplicateIndexToUuid.entries()) {
            existingDuplicateUuids.push(existingUuid);
            try {
              // For duplicates, the validation should always be invalid (duplicate geometry is a validation failure)
              duplicateValidations.push({
                type: "validation",
                id: existingUuid,
                attributes: {
                  criteriaId: 16, // DUPLICATE_GEOMETRY criteria ID
                  valid: false, // Duplicates are always invalid
                  createdAt: new Date(),
                  extraInfo: {
                    polygonUuid: existingUuid,
                    message: "This geometry already exists in the project"
                  }
                }
              });
            } catch (error) {
              this.logger.warn(`Could not create validation for duplicate polygon ${existingUuid}:`, error);
            }
          }

          if (existingDuplicateUuids.length > 0) {
            const existingDuplicatePolygons = await SitePolygon.findAll({
              where: { polygonUuid: existingDuplicateUuids, isActive: true },
              transaction
            });
            allDuplicatePolygons.push(...existingDuplicatePolygons);

            for (const duplicatePolygon of existingDuplicatePolygons) {
              const validationIndex = duplicateValidations.findIndex(v => v.id === duplicatePolygon.polygonUuid);
              if (validationIndex !== -1) {
                duplicateValidations[validationIndex].attributes.extraInfo = {
                  ...duplicateValidations[validationIndex].attributes.extraInfo,
                  sitePolygonUuid: duplicatePolygon.uuid,
                  sitePolygonName: duplicatePolygon.polyName
                };
              }
            }
          }

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
        await this.polygonGeometryService.bulkUpdateSitePolygonAreas(allPolygonUuids, transaction);
      }

      await transaction.commit();

      return {
        createdPolygons: allCreatedSitePolygons,
        duplicatePolygons: allDuplicatePolygons,
        duplicateValidations
      };
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

  private async checkDuplicates(features: Feature[], siteId: string): Promise<DuplicateCheckResult> {
    try {
      this.logger.debug(`🔍 DUPLICATE_CHECK: Checking duplicates for ${features.length} features in site ${siteId}`);
      const duplicateResult = await this.duplicateGeometryValidator.checkNewFeaturesDuplicates(features, siteId);
      this.logger.debug(
        `🔍 DUPLICATE_CHECK: Result - valid=${duplicateResult.valid}, duplicates=${duplicateResult.duplicates.length}`
      );

      const duplicateIndexToUuid = new Map<number, string>();

      if (!duplicateResult.valid && duplicateResult.duplicates.length > 0) {
        this.logger.debug(`🔍 DUPLICATE_CHECK: Found ${duplicateResult.duplicates.length} duplicates`);
        for (const duplicate of duplicateResult.duplicates) {
          duplicateIndexToUuid.set(duplicate.index, duplicate.existing_uuid);
          this.logger.debug(`🔍 DUPLICATE_CHECK: Index ${duplicate.index} matches existing ${duplicate.existing_uuid}`);
        }
      }

      return { duplicateIndexToUuid };
    } catch (error) {
      this.logger.error("Error checking for duplicate geometries", error);
      return { duplicateIndexToUuid: new Map() };
    }
  }

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
    const geometries = features.map(f => f.geometry);

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
    const additionalDataRecords: Partial<SitePolygonData>[] = [];
    let polygonIndex = 0;

    for (let i = 0; i < features.length; i++) {
      const feature = features[i];
      const geometry = feature.geometry;
      const properties = feature.properties;
      const numPolygons = geometry.type === "MultiPolygon" ? (geometry.coordinates as number[][][][]).length : 1;

      for (let j = 0; j < numPolygons; j++) {
        const primaryUuid = uuidv4();
        const sitePolygonUuid = uuidv4();

        const allProperties = { ...properties };
        if (siteId != null) {
          allProperties.site_id = siteId;
        }

        const validatedProperties = validateSitePolygonProperties(allProperties);
        const additionalData = extractAdditionalData(allProperties);

        validatedProperties.calcArea = areas[polygonIndex] ?? null;

        sitePolygons.push({
          uuid: sitePolygonUuid,
          primaryUuid,
          siteUuid: siteId,
          polygonUuid: polygonUuids[polygonIndex],
          ...validatedProperties,
          source: SOURCE_GREENHOUSE,
          createdBy: userId,
          isActive: true,
          status: "draft"
        });

        if (Object.keys(additionalData).length > 0) {
          additionalDataRecords.push({
            sitePolygonUuid,
            data: additionalData
          });
        }

        polygonIndex++;
      }
    }

    const createdSitePolygons = await SitePolygon.bulkCreate(sitePolygons as SitePolygon[], { transaction });

    if (additionalDataRecords.length > 0) {
      await SitePolygonData.bulkCreate(additionalDataRecords as SitePolygonData[], { transaction });
    }

    return createdSitePolygons;
  }
}

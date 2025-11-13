import { Injectable, BadRequestException } from "@nestjs/common";
import { Site, SitePolygon, PolygonGeometry, SitePolygonData } from "@terramatch-microservices/database/entities";
import { Transaction, Op } from "sequelize";
import { v4 as uuidv4 } from "uuid";
import { CreateSitePolygonBatchRequestDto, Feature } from "./dto/create-site-polygon-request.dto";
import { PolygonGeometryCreationService } from "./polygon-geometry-creation.service";
import { PointGeometryCreationService } from "./point-geometry-creation.service";
import { validateSitePolygonProperties, extractAdditionalData } from "./utils/site-polygon-property-validator";
import { DuplicateGeometryValidator } from "../validations/validators/duplicate-geometry.validator";
import {
  CriteriaId,
  VALIDATION_CRITERIA_IDS,
  CRITERIA_ID_TO_VALIDATION_TYPE,
  ValidationType
} from "@terramatch-microservices/database/constants";
import { VoronoiService } from "../voronoi/voronoi.service";

interface DuplicateCheckResult {
  duplicateIndexToUuid: Map<number, string>;
}

interface ValidationIncludedData {
  type: "validation";
  id: string;
  attributes: {
    polygonUuid: string;
    criteriaList: Array<{
      criteriaId: CriteriaId;
      validationType: ValidationType;
      valid: boolean;
      createdAt: Date;
      extraInfo: {
        polygonUuid: string;
        message: string;
        sitePolygonUuid?: string;
        sitePolygonName?: string;
      };
    }>;
  };
}

const CHUNK_SIZE = 500;
const LARGE_BATCH_THRESHOLD = 1000;

@Injectable()
export class SitePolygonCreationService {
  constructor(
    private readonly polygonGeometryService: PolygonGeometryCreationService,
    private readonly pointGeometryService: PointGeometryCreationService,
    private readonly duplicateGeometryValidator: DuplicateGeometryValidator,
    private readonly voronoiService: VoronoiService
  ) {}

  async createSitePolygons(
    request: CreateSitePolygonBatchRequestDto,
    userId: number,
    source: string,
    userFullName: string | null
  ): Promise<{
    data: SitePolygon[];
    included: ValidationIncludedData[];
  }> {
    const { createdPolygons, duplicatePolygons, duplicateValidations } = await this.storeAndValidateGeometries(
      request.geometries,
      userId,
      source,
      userFullName
    );

    const allPolygons = [...createdPolygons, ...duplicatePolygons];

    return {
      data: allPolygons,
      included: duplicateValidations
    };
  }

  private async storeAndValidateGeometries(
    geometries: { type: string; features: Feature[] }[],
    userId: number,
    source: string,
    userFullName: string | null
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
        const { features: mergedFeatures, duplicatePointUuids } = await this.transformPointFeaturesToPolygons(
          siteGeometries,
          siteId,
          userId,
          transaction
        );

        if (duplicatePointUuids.length > 0) {
          const existingPointSitePolygons = await SitePolygon.findAll({
            where: { pointUuid: { [Op.in]: duplicatePointUuids }, isActive: true, siteUuid: siteId },
            transaction
          });

          if (existingPointSitePolygons.length > 0) {
            allDuplicatePolygons.push(...existingPointSitePolygons);
            const duplicatePointValidationMap = new Map<string, ValidationIncludedData>();

            for (const duplicateSitePolygon of existingPointSitePolygons) {
              if (duplicateSitePolygon.polygonUuid != null) {
                const existingUuid = duplicateSitePolygon.polygonUuid;

                if (!duplicatePointValidationMap.has(existingUuid)) {
                  duplicatePointValidationMap.set(existingUuid, {
                    type: "validation",
                    id: existingUuid,
                    attributes: {
                      polygonUuid: existingUuid,
                      criteriaList: [
                        {
                          criteriaId: VALIDATION_CRITERIA_IDS.DUPLICATE_GEOMETRY,
                          validationType: CRITERIA_ID_TO_VALIDATION_TYPE[VALIDATION_CRITERIA_IDS.DUPLICATE_GEOMETRY],
                          valid: false,
                          createdAt: new Date(),
                          extraInfo: {
                            polygonUuid: existingUuid,
                            message: "This geometry already exists in the project",
                            sitePolygonUuid: duplicateSitePolygon.uuid,
                            sitePolygonName: duplicateSitePolygon.polyName ?? undefined
                          }
                        }
                      ]
                    }
                  });
                }
              }
            }

            duplicateValidations.push(...duplicatePointValidationMap.values());
          }
        }

        const groupedByType = this.groupGeometriesByType(mergedFeatures);

        for (const [, typeFeatures] of Object.entries(groupedByType)) {
          const voronoiFeatures: Feature[] = [];
          const regularFeatures: Feature[] = [];

          for (const feature of typeFeatures) {
            if (feature.properties?._fromVoronoi === true) {
              voronoiFeatures.push(feature);
            } else {
              regularFeatures.push(feature);
            }
          }

          let duplicateIndexToUuid = new Map<number, string>();
          if (regularFeatures.length > 0) {
            const duplicateResult = await this.checkDuplicates(regularFeatures, siteId);
            duplicateIndexToUuid = duplicateResult.duplicateIndexToUuid;
          }

          const existingDuplicateUuids: string[] = [];
          const duplicateValidationMap = new Map<string, ValidationIncludedData>();

          for (const [, existingUuid] of duplicateIndexToUuid.entries()) {
            existingDuplicateUuids.push(existingUuid);

            if (!duplicateValidationMap.has(existingUuid)) {
              duplicateValidationMap.set(existingUuid, {
                type: "validation",
                id: existingUuid,
                attributes: {
                  polygonUuid: existingUuid,
                  criteriaList: []
                }
              });
            }

            const validation = duplicateValidationMap.get(existingUuid);
            if (validation != null) {
              validation.attributes.criteriaList.push({
                criteriaId: VALIDATION_CRITERIA_IDS.DUPLICATE_GEOMETRY,
                validationType: CRITERIA_ID_TO_VALIDATION_TYPE[VALIDATION_CRITERIA_IDS.DUPLICATE_GEOMETRY],
                valid: false,
                createdAt: new Date(),
                extraInfo: {
                  polygonUuid: existingUuid,
                  message: "This geometry already exists in the project"
                }
              });
            }
          }

          if (existingDuplicateUuids.length > 0) {
            const existingDuplicatePolygons = await SitePolygon.findAll({
              where: { polygonUuid: existingDuplicateUuids, isActive: true },
              transaction
            });
            allDuplicatePolygons.push(...existingDuplicatePolygons);

            for (const duplicatePolygon of existingDuplicatePolygons) {
              const validation = duplicateValidationMap.get(duplicatePolygon.polygonUuid);
              if (validation != null) {
                const duplicateCriteria = validation.attributes.criteriaList.find(c => c.criteriaId === 16);
                if (duplicateCriteria != null) {
                  duplicateCriteria.extraInfo = {
                    ...duplicateCriteria.extraInfo,
                    sitePolygonUuid: duplicatePolygon.uuid,
                    sitePolygonName: duplicatePolygon.polyName ?? undefined
                  };
                }
              }
            }

            duplicateValidations.push(...duplicateValidationMap.values());
          }

          const { filteredFeatures: filteredRegularFeatures } = this.filterDuplicates(
            regularFeatures,
            duplicateIndexToUuid
          );

          const allFeaturesToCreate = [...filteredRegularFeatures, ...voronoiFeatures];

          let createdSitePolygons: SitePolygon[];
          if (allFeaturesToCreate.length > 0) {
            if (allFeaturesToCreate.length > LARGE_BATCH_THRESHOLD) {
              createdSitePolygons = await this.processLargeGeometryBatch(
                allFeaturesToCreate,
                siteId,
                userId,
                source,
                transaction
              );
            } else {
              createdSitePolygons = await this.createPolygonsBatch(
                allFeaturesToCreate,
                siteId,
                userId,
                source,
                transaction
              );
            }

            allCreatedSitePolygons.push(...createdSitePolygons);
            allPolygonUuids.push(
              ...createdSitePolygons.map(sp => sp.polygonUuid).filter((u): u is string => u != null)
            );
          }
        }
      }

      if (allCreatedSitePolygons.length > 0) {
        await this.updateSitePolygonNames(allCreatedSitePolygons, userFullName, transaction);
      }

      if (allPolygonUuids.length > 0) {
        await this.polygonGeometryService.bulkUpdateSitePolygonCentroids(allPolygonUuids, transaction);
        await this.polygonGeometryService.bulkUpdateSitePolygonAreas(allPolygonUuids, transaction);
        await this.polygonGeometryService.bulkUpdateProjectCentroids(allPolygonUuids, transaction);
      }

      await transaction.commit();

      return {
        createdPolygons: allCreatedSitePolygons,
        duplicatePolygons: allDuplicatePolygons,
        duplicateValidations
      };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  private async transformPointFeaturesToPolygons(
    features: Feature[],
    siteId: string,
    userId: number,
    transaction: Transaction
  ): Promise<{ features: Feature[]; duplicatePointUuids: string[] }> {
    const points = features.filter(f => f.geometry.type === "Point");
    if (points.length === 0) {
      return { features, duplicatePointUuids: [] };
    }

    for (const p of points) {
      const props = p.properties ?? {};
      if (props.est_area == null) {
        throw new BadRequestException("Point features must include properties.est_area");
      }
      if (props.site_id == null) {
        throw new BadRequestException("Point features must include properties.site_id");
      }
    }

    const { duplicateIndexToUuid: pointDuplicateMap } = await this.duplicateGeometryValidator.checkNewPointsDuplicates(
      points,
      siteId
    );

    const newPoints: Feature[] = [];
    const duplicatePointUuids: string[] = [];
    const newPointIndices: number[] = [];
    const pointIndexToUuidMap = new Map<number, string>();

    for (let i = 0; i < points.length; i++) {
      const existingUuid = pointDuplicateMap.get(i);
      if (existingUuid != null) {
        pointIndexToUuidMap.set(i, existingUuid);
        duplicatePointUuids.push(existingUuid);
      } else {
        newPoints.push(points[i]);
        newPointIndices.push(i);
      }
    }

    const newPointUuids: string[] = [];
    if (newPoints.length > 0) {
      const createdUuids = await this.pointGeometryService.createPointGeometriesFromFeatures(
        newPoints,
        userId,
        transaction
      );
      newPointUuids.push(...createdUuids);

      for (let j = 0; j < newPointUuids.length && j < newPointIndices.length; j++) {
        pointIndexToUuidMap.set(newPointIndices[j], newPointUuids[j]);
      }
    }

    for (let i = 0; i < points.length; i++) {
      const point = points[i];
      const pointUuid = pointIndexToUuidMap.get(i);
      if (point.properties == null) {
        throw new BadRequestException("Point feature properties cannot be null");
      }
      if (pointUuid != null) {
        point.properties._pointUuid = pointUuid;
      }
    }

    const voronoiPolys = newPoints.length > 0 ? await this.voronoiService.transformPointsToPolygons(newPoints) : [];

    for (const voronoiPoly of voronoiPolys) {
      if (voronoiPoly.properties != null) {
        voronoiPoly.properties._fromVoronoi = true;
      }
    }

    const nonPoints = features.filter(f => f.geometry.type !== "Point");
    return { features: [...nonPoints, ...voronoiPolys], duplicatePointUuids };
  }

  private groupGeometriesBySiteId(geometries: { features: Feature[] }[]): { [siteId: string]: Feature[] } {
    const grouped: { [siteId: string]: Feature[] } = {};

    for (const geometryCollection of geometries) {
      if (geometryCollection.features == null) {
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
      const duplicateResult = await this.duplicateGeometryValidator.checkNewFeaturesDuplicates(features, siteId);
      const duplicateIndexToUuid = new Map<number, string>();

      if (!duplicateResult.valid && duplicateResult.duplicates.length > 0) {
        for (const duplicate of duplicateResult.duplicates) {
          duplicateIndexToUuid.set(duplicate.index, duplicate.existing_uuid);
        }
      }

      return { duplicateIndexToUuid };
    } catch {
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
    source: string,
    transaction: Transaction
  ): Promise<SitePolygon[]> {
    const allSitePolygons: SitePolygon[] = [];

    for (let i = 0; i < features.length; i += CHUNK_SIZE) {
      const chunk = features.slice(i, i + CHUNK_SIZE);
      const chunkSitePolygons = await this.createPolygonsBatch(chunk, siteId, userId, source, transaction);
      allSitePolygons.push(...chunkSitePolygons);
    }

    return allSitePolygons;
  }

  private async createPolygonsBatch(
    features: Feature[],
    siteId: string,
    userId: number,
    source: string,
    transaction: Transaction
  ): Promise<SitePolygon[]> {
    const geometries = features.map(f => f.geometry);

    const { uuids: polygonUuids, areas } = await this.polygonGeometryService.createGeometriesFromFeatures(
      geometries,
      userId,
      transaction
    );

    return await this.createSitePolygonRecords(features, polygonUuids, areas, siteId, userId, source, transaction);
  }

  private async createSitePolygonRecords(
    features: Feature[],
    polygonUuids: string[],
    areas: number[],
    siteId: string,
    userId: number,
    source: string,
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
        const sitePolygonUuid = uuidv4();

        const allProperties = { ...properties };
        if (siteId != null) {
          allProperties.site_id = siteId;
        }

        const validatedProperties = validateSitePolygonProperties(allProperties);
        const additionalData = extractAdditionalData(allProperties);

        validatedProperties.calcArea = areas[polygonIndex] ?? null;

        const pointUuid = (allProperties._pointUuid as string) ?? null;
        if (pointUuid != null) {
          validatedProperties.pointUuid = pointUuid;
        }

        sitePolygons.push({
          uuid: sitePolygonUuid,
          primaryUuid: sitePolygonUuid,
          siteUuid: siteId,
          polygonUuid: polygonUuids[polygonIndex],
          ...validatedProperties,
          source,
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

  private async updateSitePolygonNames(
    sitePolygons: SitePolygon[],
    userFullName: string | null,
    transaction: Transaction
  ): Promise<void> {
    if (sitePolygons.length === 0) {
      return;
    }

    const now = new Date();
    const dateFormat = `${now.getDate()}_${now.toLocaleDateString("en-US", {
      month: "long"
    })}_${now.getFullYear()}_${String(now.getHours()).padStart(2, "0")}_${String(now.getMinutes()).padStart(
      2,
      "0"
    )}_${String(now.getSeconds()).padStart(2, "0")}`;
    const suffix = userFullName != null ? `_${userFullName}` : "";

    const polygonsToUpdate = sitePolygons.filter(sp => sp.polyName == null || sp.polyName.trim() === "");

    for (const polygon of polygonsToUpdate) {
      await SitePolygon.update({ polyName: `${dateFormat}${suffix}` }, { where: { uuid: polygon.uuid }, transaction });
    }
  }
}

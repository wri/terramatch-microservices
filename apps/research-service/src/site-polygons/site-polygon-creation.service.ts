import { Injectable, BadRequestException } from "@nestjs/common";
import {
  Site,
  SitePolygon,
  PolygonGeometry,
  SitePolygonData,
  CriteriaSite
} from "@terramatch-microservices/database/entities";
import { Transaction, Op } from "sequelize";
import { v4 as uuidv4 } from "uuid";
import {
  CreateSitePolygonBatchRequestDto,
  Feature,
  AttributeChangesDto,
  CreateSitePolygonRequestDto
} from "./dto/create-site-polygon-request.dto";
import { PolygonGeometryCreationService } from "./polygon-geometry-creation.service";
import { PointGeometryCreationService } from "./point-geometry-creation.service";
import { SitePolygonVersioningService } from "./site-polygon-versioning.service";
import {
  validateSitePolygonProperties,
  extractAdditionalData,
  validateAndSortStringArray,
  VALID_PRACTICE_VALUES,
  VALID_DISTRIBUTION_VALUES
} from "./utils/site-polygon-property-validator";
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
    private readonly voronoiService: VoronoiService,
    private readonly versioningService: SitePolygonVersioningService
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
    const transaction = await PolygonGeometry.sql.transaction();
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
    const points: Feature[] = [];
    for (const feature of features) {
      const geometry = feature.geometry;
      const geometryType = geometry.type as string;

      if (geometryType === "MultiPoint") {
        const coordinates = geometry.coordinates as unknown as number[][];
        for (const pointCoords of coordinates) {
          points.push({
            type: "Feature",
            geometry: {
              type: "Point",
              coordinates: pointCoords
            },
            properties: { ...feature.properties }
          });
        }
      } else if (geometry.type === "Point") {
        points.push(feature);
      }
    }

    if (points.length === 0) {
      return { features, duplicatePointUuids: [] };
    }

    for (const p of points) {
      const props = p.properties ?? {};
      const estAreaValue = (props.estArea as number) ?? (props.est_area as number);
      if (estAreaValue == null) {
        throw new BadRequestException("Point features must include properties.estArea");
      }
      const siteIdValue = (props.siteId as string) ?? (props.site_id as string);
      if (siteIdValue == null) {
        throw new BadRequestException("Point features must include properties.siteId");
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

    const nonPoints = features.filter(f => {
      const geomType = f.geometry.type as string;
      return geomType !== "Point" && geomType !== "MultiPoint";
    });
    return { features: [...nonPoints, ...voronoiPolys], duplicatePointUuids };
  }

  private groupGeometriesBySiteId(geometries: { features: Feature[] }[]): { [siteId: string]: Feature[] } {
    const grouped: { [siteId: string]: Feature[] } = {};

    for (const geometryCollection of geometries) {
      if (geometryCollection.features == null) {
        continue;
      }

      for (const feature of geometryCollection.features) {
        const siteId = (feature.properties.siteId as string) ?? (feature.properties.site_id as string);
        if (siteId == null) {
          throw new BadRequestException("All features must have siteId in properties");
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
    const unsupportedTypes = new Set<string>();
    for (const feature of features) {
      const geomType = feature.geometry.type as string;
      if (geomType !== "Polygon" && geomType !== "MultiPolygon" && geomType !== "Point" && geomType !== "MultiPoint") {
        unsupportedTypes.add(geomType);
      }
    }

    if (unsupportedTypes.size > 0) {
      throw new BadRequestException(
        `Unsupported geometry types: ${Array.from(unsupportedTypes).join(", ")}. ` +
          `Only Polygon, MultiPolygon, Point, and MultiPoint are supported.`
      );
    }

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
          allProperties.siteId = siteId;
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
          status: "draft",
          validationStatus: null
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

    if (polygonUuids.length > 0) {
      await CriteriaSite.destroy({
        where: { polygonId: { [Op.in]: polygonUuids } },
        transaction
      });
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

  async createSitePolygonVersion(
    baseSitePolygonUuid: string,
    newGeometry: CreateSitePolygonRequestDto[] | undefined,
    attributeChanges: AttributeChangesDto | undefined,
    changeReason: string,
    userId: number,
    userFullName: string | null,
    source: string,
    transaction: Transaction
  ): Promise<SitePolygon> {
    const basePolygon = await this.versioningService.validateVersioningEligibility(baseSitePolygonUuid);

    let newPolygonGeometryUuid: string | null = null;
    const sitePolygonAttributes: Partial<SitePolygon> = {};

    if (newGeometry != null && newGeometry.length > 0) {
      const features = newGeometry.flatMap(g => g.features);

      if (features.length === 0) {
        throw new BadRequestException("No features provided in geometry collection");
      }

      if (features.length > 1) {
        throw new BadRequestException(
          `Version creation only supports single polygon. Received ${features.length} features`
        );
      }

      const { uuids, areas } = await this.polygonGeometryService.createGeometriesFromFeatures(
        features.map(f => f.geometry),
        userId,
        transaction
      );

      newPolygonGeometryUuid = uuids[0];
      sitePolygonAttributes.calcArea = areas[0];

      await this.polygonGeometryService.bulkUpdateSitePolygonCentroids([newPolygonGeometryUuid], transaction);
      await this.polygonGeometryService.bulkUpdateSitePolygonAreas([newPolygonGeometryUuid], transaction);
      await this.polygonGeometryService.bulkUpdateProjectCentroids([newPolygonGeometryUuid], transaction);
    }

    if (attributeChanges != null) {
      const polyName = attributeChanges.polyName ?? attributeChanges.poly_name;
      if (polyName != null && polyName.length > 0) {
        sitePolygonAttributes.polyName = polyName;
      }

      const plantStart = attributeChanges.plantStart ?? attributeChanges.plantstart;
      if (plantStart != null && plantStart.length > 0) {
        sitePolygonAttributes.plantStart = new Date(plantStart);
      }

      if (attributeChanges.practice != null && attributeChanges.practice.length > 0) {
        sitePolygonAttributes.practice = validateAndSortStringArray(attributeChanges.practice, VALID_PRACTICE_VALUES);
      }

      const targetSys = attributeChanges.targetSys ?? attributeChanges.target_sys;
      if (targetSys != null && targetSys.length > 0) {
        sitePolygonAttributes.targetSys = targetSys;
      }

      if (attributeChanges.distr != null && attributeChanges.distr.length > 0) {
        sitePolygonAttributes.distr = validateAndSortStringArray(attributeChanges.distr, VALID_DISTRIBUTION_VALUES);
      }

      const numTrees = attributeChanges.numTrees ?? attributeChanges.num_trees;
      if (numTrees != null) {
        sitePolygonAttributes.numTrees = numTrees;
      }
    }
    sitePolygonAttributes.validationStatus = null;
    sitePolygonAttributes.status = "draft";

    const polygonUuidToClear = newPolygonGeometryUuid ?? basePolygon.polygonUuid;

    if (polygonUuidToClear != null) {
      await CriteriaSite.destroy({
        where: { polygonId: polygonUuidToClear },
        transaction
      });
    }

    const changeDescription = this.buildDetailedChangeDescription(
      basePolygon,
      sitePolygonAttributes,
      newPolygonGeometryUuid != null
    );

    return await this.versioningService.createVersion(
      basePolygon,
      sitePolygonAttributes,
      newPolygonGeometryUuid,
      userId,
      `${changeReason} - ${changeDescription}`,
      userFullName,
      transaction
    );
  }

  private buildDetailedChangeDescription(
    basePolygon: SitePolygon,
    changes: Partial<SitePolygon>,
    geometryChanged: boolean
  ): string {
    const parts: string[] = [];

    if (geometryChanged) {
      parts.push("Geometry updated");
    }

    for (const [key, newValue] of Object.entries(changes)) {
      if (key === "status") continue;
      const oldValue = basePolygon[key as keyof SitePolygon];
      if (oldValue !== newValue && newValue != null) {
        parts.push(`${key} => from ${oldValue ?? "null"} to ${newValue}`);
      }
    }

    const description = parts.join(", ");
    return description.length > 0 ? description : "Version created";
  }
}

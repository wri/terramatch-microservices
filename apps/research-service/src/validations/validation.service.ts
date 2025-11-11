import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import {
  CriteriaSite,
  CriteriaSiteHistoric,
  PolygonGeometry,
  SitePolygon,
  Site
} from "@terramatch-microservices/database/entities";
import { ValidationDto } from "./dto/validation.dto";
import { ValidationCriteriaDto } from "./dto/validation-criteria.dto";
import { populateDto } from "@terramatch-microservices/common/dto/json-api-attributes";
import { MAX_PAGE_SIZE } from "@terramatch-microservices/common/util/paginated-query.builder";
import { groupBy } from "lodash";
import { SelfIntersectionValidator } from "./validators/self-intersection.validator";
import { SpikesValidator } from "./validators/spikes.validator";
import { DataCompletenessValidator } from "./validators/data-completeness.validator";
import { PlantStartDateValidator } from "./validators/plant-start-date.validator";
import { PolygonSizeValidator } from "./validators/polygon-size.validator";
import { EstimatedAreaValidator } from "./validators/estimated-area.validator";
import { OverlappingValidator } from "./validators/overlapping.validator";
import { WithinCountryValidator } from "./validators/within-country.validator";
import { DuplicateGeometryValidator } from "./validators/duplicate-geometry.validator";
import { FeatureBoundsValidator } from "./validators/feature-bounds.validator";
import { GeometryTypeValidator } from "./validators/geometry-type.validator";
import { Validator, isPolygonValidator, isGeometryValidator } from "./validators/validator.interface";
import {
  ValidationType,
  VALIDATION_CRITERIA_IDS,
  CriteriaId,
  EXCLUDED_VALIDATION_CRITERIA,
  CRITERIA_ID_TO_VALIDATION_TYPE
} from "@terramatch-microservices/database/constants";
import { Op } from "sequelize";
import { validateFeatureCollectionStructure } from "./utils/geojson-structure-validator";

const DATA_COMPLETENESS_CRITERIA_ID = VALIDATION_CRITERIA_IDS.DATA_COMPLETENESS;

type ValidationResult = {
  polygonUuid: string;
  criteriaId: CriteriaId;
  valid: boolean;
  extraInfo: object | null;
};

type CriteriaRecord = {
  polygonId: string;
  criteriaId: CriteriaId;
  valid: boolean;
  extraInfo: object | null;
};

export const VALIDATORS: Record<ValidationType, Validator> = {
  SELF_INTERSECTION: new SelfIntersectionValidator(),
  POLYGON_SIZE: new PolygonSizeValidator(),
  SPIKES: new SpikesValidator(),
  ESTIMATED_AREA: new EstimatedAreaValidator(),
  DATA_COMPLETENESS: new DataCompletenessValidator(),
  PLANT_START_DATE: new PlantStartDateValidator(),
  OVERLAPPING: new OverlappingValidator(),
  DUPLICATE_GEOMETRY: new DuplicateGeometryValidator(),
  WITHIN_COUNTRY: new WithinCountryValidator(),
  FEATURE_BOUNDS: new FeatureBoundsValidator(),
  GEOMETRY_TYPE: new GeometryTypeValidator()
};

@Injectable()
export class ValidationService {
  async getPolygonValidation(polygonUuid: string): Promise<ValidationDto> {
    const polygon = await PolygonGeometry.findOne({
      where: { uuid: polygonUuid },
      attributes: ["uuid"]
    });

    if (polygon === null) {
      throw new NotFoundException(`Polygon with UUID ${polygonUuid} not found`);
    }

    const criteriaData = await CriteriaSite.findAll({
      where: { polygonId: polygonUuid },
      attributes: ["criteriaId", "valid", "createdAt", "extraInfo"],
      order: [["createdAt", "DESC"]]
    });

    const criteriaList: ValidationCriteriaDto[] = criteriaData.map(criteria => ({
      criteriaId: criteria.criteriaId,
      validationType: CRITERIA_ID_TO_VALIDATION_TYPE[criteria.criteriaId],
      valid: Boolean(criteria.valid),
      createdAt: criteria.createdAt,
      extraInfo: criteria.extraInfo
    }));

    const dto = new ValidationDto();
    return populateDto(dto, {
      polygonUuid,
      criteriaList
    });
  }

  async getSiteValidations(
    siteUuid: string,
    pageSize: number,
    pageNumber = 1,
    criteriaId?: CriteriaId
  ): Promise<{
    validations: ValidationDto[];
    total: number;
  }> {
    if (pageSize > MAX_PAGE_SIZE || pageSize < 1) {
      throw new BadRequestException(`Invalid page size: ${pageSize}`);
    }
    if (pageNumber < 1) {
      throw new BadRequestException(`Invalid page number: ${pageNumber}`);
    }

    const allSitePolygons = await SitePolygon.findAll({
      where: {
        siteUuid,
        isActive: true
      },
      attributes: ["polygonUuid"]
    });

    const allPolygonUuids = allSitePolygons
      .map(polygon => polygon.polygonUuid)
      .filter(uuid => uuid !== null) as string[];

    if (allPolygonUuids.length === 0) {
      return {
        validations: [],
        total: 0
      };
    }

    const allCriteriaData = await CriteriaSite.findAll({
      where: { polygonId: allPolygonUuids },
      attributes: ["polygonId", "criteriaId", "valid", "createdAt", "extraInfo"],
      order: [["createdAt", "DESC"]]
    });

    let polygonsWithValidations: string[];
    if (criteriaId !== undefined) {
      const filteredCriteriaData = allCriteriaData.filter(
        criteria => criteria.criteriaId === criteriaId && criteria.valid === false
      );
      polygonsWithValidations = [...new Set(filteredCriteriaData.map(criteria => criteria.polygonId))];
    } else {
      const criteriaByPolygon = groupBy(allCriteriaData, "polygonId");
      polygonsWithValidations = Object.keys(criteriaByPolygon);
    }

    const total = polygonsWithValidations.length;

    const startIndex = (pageNumber - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const paginatedPolygonIds = polygonsWithValidations.slice(startIndex, endIndex);

    const criteriaByPolygon = groupBy(allCriteriaData, "polygonId");

    const validations = paginatedPolygonIds.map(polygonId =>
      populateDto<ValidationDto>(new ValidationDto(), {
        polygonUuid: polygonId,
        criteriaList: (criteriaByPolygon[polygonId] ?? []).map(criteria => ({
          criteriaId: criteria.criteriaId,
          validationType: CRITERIA_ID_TO_VALIDATION_TYPE[criteria.criteriaId],
          valid: Boolean(criteria.valid),
          createdAt: criteria.createdAt,
          extraInfo: criteria.extraInfo
        }))
      })
    );

    return {
      validations,
      total
    };
  }

  private getCriteriaIdForValidationType(validationType: ValidationType): CriteriaId {
    return VALIDATION_CRITERIA_IDS[validationType];
  }

  private async saveValidationResult(
    polygonUuid: string,
    criteriaId: CriteriaId,
    valid: boolean,
    extraInfo: object | null
  ): Promise<void> {
    const existingCriteria = await CriteriaSite.findOne({
      where: {
        polygonId: polygonUuid,
        criteriaId
      }
    });

    if (existingCriteria !== null) {
      const historicRecord = new CriteriaSiteHistoric();
      historicRecord.polygonId = polygonUuid;
      historicRecord.criteriaId = criteriaId;
      historicRecord.valid = existingCriteria.valid;
      historicRecord.extraInfo = existingCriteria.extraInfo;
      await historicRecord.save();
      await existingCriteria.destroy();
    }

    await CriteriaSite.create({
      polygonId: polygonUuid,
      criteriaId: criteriaId,
      valid: valid,
      extraInfo: extraInfo
    } as CriteriaSite);
  }

  async getSitePolygonUuids(siteUuid: string): Promise<string[]> {
    const site = await Site.findOne({
      where: { uuid: siteUuid },
      attributes: ["uuid"]
    });

    if (site === null) {
      throw new NotFoundException(`Site with UUID ${siteUuid} not found`);
    }

    const sitePolygons = await SitePolygon.findAll({
      where: {
        siteUuid,
        polygonUuid: { [Op.ne]: "" },
        isActive: true,
        deletedAt: null
      },
      attributes: ["polygonUuid"]
    });

    return sitePolygons.map(sp => sp.polygonUuid).filter(uuid => uuid != null && uuid !== "") as string[];
  }

  async validatePolygonsBatch(polygonUuids: string[], validationTypes: ValidationType[]): Promise<void> {
    const validationResults: ValidationResult[] = [];

    for (const validationType of validationTypes) {
      const validator = VALIDATORS[validationType];
      if (validator == null) {
        throw new BadRequestException(`Unknown validation type: ${validationType}`);
      }

      const criteriaId = this.getCriteriaIdForValidationType(validationType);

      if (isPolygonValidator(validator) && validator.validatePolygons != null) {
        const batchResults = await validator.validatePolygons(polygonUuids);

        const seenPolygons = new Set<string>();
        for (const result of batchResults) {
          if (seenPolygons.has(result.polygonUuid)) {
            throw new BadRequestException(
              `Duplicate result from ${validationType} validator for polygon ${result.polygonUuid}`
            );
          }
          seenPolygons.add(result.polygonUuid);

          validationResults.push({
            polygonUuid: result.polygonUuid,
            criteriaId,
            valid: result.valid,
            extraInfo: result.extraInfo
          });
        }
      } else {
        if (validator == null || !isPolygonValidator(validator)) {
          throw new BadRequestException(`Validation type ${validationType} does not support polygon UUID validation.`);
        }
        for (const polygonUuid of polygonUuids) {
          const validationResult = await validator.validatePolygon(polygonUuid);
          validationResults.push({
            polygonUuid,
            criteriaId,
            valid: validationResult.valid,
            extraInfo: validationResult.extraInfo
          });
        }
      }
    }

    await this.saveValidationResultsBatch(validationResults);
  }

  async saveValidationResultsBatch(results: ValidationResult[]): Promise<void> {
    if (results.length === 0) {
      return;
    }

    const polygonIds = [...new Set(results.map(r => r.polygonUuid))];
    const criteriaIds = [...new Set(results.map(r => r.criteriaId))];

    const existingCriteria = await CriteriaSite.findAll({
      where: {
        polygonId: polygonIds,
        criteriaId: criteriaIds
      },
      attributes: ["id", "polygonId", "criteriaId", "valid", "extraInfo"]
    });

    const existingMap = new Map<string, CriteriaSite>();
    for (const criteria of existingCriteria) {
      const key = `${criteria.polygonId}_${criteria.criteriaId}`;
      existingMap.set(key, criteria);
    }

    const deduplicatedResults = new Map<string, (typeof results)[0]>();
    for (const result of results) {
      const key = `${result.polygonUuid}_${result.criteriaId}`;
      deduplicatedResults.set(key, result);
    }

    const historicRecords: CriteriaRecord[] = [];
    const recordsToCreate: CriteriaRecord[] = [];
    const recordsToDelete: number[] = [];

    for (const [key, result] of deduplicatedResults.entries()) {
      const existing = existingMap.get(key);

      if (existing != null) {
        historicRecords.push({
          polygonId: existing.polygonId,
          criteriaId: existing.criteriaId,
          valid: existing.valid,
          extraInfo: existing.extraInfo
        });
        recordsToDelete.push(existing.id);
      }

      recordsToCreate.push({
        polygonId: result.polygonUuid,
        criteriaId: result.criteriaId,
        valid: result.valid,
        extraInfo: result.extraInfo
      });
    }

    if (historicRecords.length > 0) {
      await CriteriaSiteHistoric.bulkCreate(historicRecords as never, {
        validate: true
      });
    }

    if (recordsToDelete.length > 0) {
      await CriteriaSite.destroy({
        where: {
          id: recordsToDelete
        }
      });
    }

    if (recordsToCreate.length > 0) {
      await CriteriaSite.bulkCreate(recordsToCreate as never, {
        validate: true
      });

      const affectedPolygonUuids = [...new Set(recordsToCreate.map(r => r.polygonId))];
      await this.updateSitePolygonValidityBatch(affectedPolygonUuids);
    }
  }

  private async updateSitePolygonValidityBatch(polygonUuids: string[]): Promise<void> {
    if (polygonUuids.length === 0) {
      return;
    }

    const sitePolygons = await SitePolygon.findAll({
      where: {
        polygonUuid: { [Op.in]: polygonUuids },
        isActive: true
      },
      attributes: ["id", "polygonUuid", "validationStatus"]
    });

    if (sitePolygons.length === 0) {
      return;
    }

    const allCriteria = await CriteriaSite.findAll({
      where: { polygonId: { [Op.in]: polygonUuids } },
      attributes: ["polygonId", "criteriaId", "valid", "extraInfo"]
    });

    const criteriaByPolygon = new Map<string, CriteriaSite[]>();
    for (const criteria of allCriteria) {
      if (!criteriaByPolygon.has(criteria.polygonId)) {
        criteriaByPolygon.set(criteria.polygonId, []);
      }
      const criteriaList = criteriaByPolygon.get(criteria.polygonId);
      if (criteriaList != null) {
        criteriaList.push(criteria);
      }
    }

    const baseExcludedCriteriaSet = new Set(EXCLUDED_VALIDATION_CRITERIA as number[]);
    const updates: Array<{ id: number; validationStatus: string | null }> = [];

    for (const sitePolygon of sitePolygons) {
      if (sitePolygon.polygonUuid == null) continue;

      const polygonCriteria = criteriaByPolygon.get(sitePolygon.polygonUuid) ?? [];
      const dynamicExcludedCriteria = this.getDynamicExcludedCriteria(polygonCriteria);
      const excludedCriteriaSet = new Set([...baseExcludedCriteriaSet, ...dynamicExcludedCriteria]);

      let newValidationStatus: string | null;

      if (polygonCriteria.length === 0) {
        newValidationStatus = null;
      } else {
        const hasAnyFailing = polygonCriteria.some(c => c.valid === false);

        if (!hasAnyFailing) {
          newValidationStatus = "passed";
        } else {
          const nonExcludedCriteria = polygonCriteria.filter(c => !excludedCriteriaSet.has(c.criteriaId));
          const hasFailingNonExcluded = nonExcludedCriteria.some(c => c.valid === false);

          newValidationStatus = hasFailingNonExcluded ? "failed" : "partial";
        }
      }

      if (sitePolygon.validationStatus !== newValidationStatus) {
        updates.push({
          id: sitePolygon.id,
          validationStatus: newValidationStatus
        });
      }
    }

    if (updates.length > 0) {
      await Promise.all(
        updates.map(update =>
          SitePolygon.update({ validationStatus: update.validationStatus }, { where: { id: update.id } })
        )
      );
    }
  }

  async validateGeometries(
    geometries: Array<{
      type: string;
      features: Array<{ type: string; geometry: unknown; properties?: Record<string, unknown> | null }>;
    }>,
    validationTypes: ValidationType[]
  ): Promise<
    Array<{
      type: "validation";
      id: string;
      attributes: {
        polygonUuid: string;
        criteriaList: Array<{
          criteriaId: CriteriaId;
          validationType: ValidationType;
          valid: boolean;
          createdAt: Date | null;
          extraInfo: object | null;
        }>;
      };
    }>
  > {
    for (let i = 0; i < geometries.length; i++) {
      const validationResult = validateFeatureCollectionStructure(geometries[i]);
      if (!validationResult.valid) {
        throw new BadRequestException(
          `Invalid GeoJSON FeatureCollection at index ${i}: ${validationResult.error ?? "invalid structure"}`
        );
      }
    }

    const allFeatures: Array<{ geometry: unknown; properties?: Record<string, unknown>; featureIndex: number }> = [];
    let featureIndex = 0;

    for (const featureCollection of geometries) {
      // This check is now redundant due to validation above, but kept for safety
      if (featureCollection.features == null || !Array.isArray(featureCollection.features)) {
        continue;
      }

      for (const feature of featureCollection.features) {
        if (feature.geometry != null) {
          allFeatures.push({
            geometry: feature.geometry,
            properties: feature.properties ?? undefined,
            featureIndex
          });
          featureIndex++;
        }
      }
    }

    const validationResults: Array<{
      featureIndex: number;
      featureId?: string;
      criteriaId: CriteriaId;
      validationType: ValidationType;
      valid: boolean;
      extraInfo: object | null;
    }> = [];

    for (const validationType of validationTypes) {
      const validator = VALIDATORS[validationType];
      if (validator == null) {
        continue;
      }

      if (!isGeometryValidator(validator)) {
        continue;
      }

      const criteriaId = this.getCriteriaIdForValidationType(validationType);

      for (const feature of allFeatures) {
        try {
          const result = await validator.validateGeometry(feature.geometry as never, feature.properties);
          validationResults.push({
            featureIndex: feature.featureIndex,
            featureId: feature.properties?.id as string | undefined,
            criteriaId,
            validationType,
            valid: Boolean(result.valid),
            extraInfo: result.extraInfo
          });
        } catch (error) {
          validationResults.push({
            featureIndex: feature.featureIndex,
            featureId: feature.properties?.id as string | undefined,
            criteriaId,
            validationType,
            valid: false,
            extraInfo: {
              error: error instanceof Error ? error.message : "Unknown error occurred"
            }
          });
        }
      }
    }

    const resultsByFeature = new Map<
      number,
      Array<{
        criteriaId: CriteriaId;
        validationType: ValidationType;
        valid: boolean;
        extraInfo: object | null;
      }>
    >();

    for (const result of validationResults) {
      if (!resultsByFeature.has(result.featureIndex)) {
        resultsByFeature.set(result.featureIndex, []);
      }
      const criteriaList = resultsByFeature.get(result.featureIndex);
      if (criteriaList != null) {
        criteriaList.push({
          criteriaId: result.criteriaId,
          validationType: result.validationType,
          valid: Boolean(result.valid),
          extraInfo: result.extraInfo
        });
      }
    }

    const included: Array<{
      type: "validation";
      id: string;
      attributes: {
        polygonUuid: string;
        criteriaList: Array<{
          criteriaId: CriteriaId;
          validationType: ValidationType;
          valid: boolean;
          createdAt: Date | null;
          extraInfo: object | null;
        }>;
      };
    }> = [];

    for (const [index, criteriaList] of resultsByFeature.entries()) {
      const feature = allFeatures[index];
      const polygonUuid = (feature?.properties?.id as string) ?? `feature-${index}`;

      included.push({
        type: "validation",
        id: polygonUuid,
        attributes: {
          polygonUuid,
          criteriaList: criteriaList.map(criteria => ({
            ...criteria,
            createdAt: null
          }))
        }
      });
    }

    return included;
  }

  private getDynamicExcludedCriteria(allCriteria: CriteriaSite[]): CriteriaId[] {
    const dynamicExcludedCriteria: CriteriaId[] = [];

    const dataCriteria = allCriteria.find(c => c.criteriaId === DATA_COMPLETENESS_CRITERIA_ID);

    if (dataCriteria != null && dataCriteria.valid === false && dataCriteria.extraInfo != null) {
      const validationErrors = Array.isArray(dataCriteria.extraInfo) ? dataCriteria.extraInfo : [];
      const numTreesError = validationErrors.find((error: { field?: string }) => error.field === "num_trees");
      const hasOnlyNumTreesError = validationErrors.length === 1 && numTreesError != null;

      if (hasOnlyNumTreesError) {
        dynamicExcludedCriteria.push(DATA_COMPLETENESS_CRITERIA_ID);
      }
    }

    return dynamicExcludedCriteria;
  }
}

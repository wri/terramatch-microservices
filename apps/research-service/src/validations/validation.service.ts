import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import {
  CriteriaSite,
  CriteriaSiteHistoric,
  PolygonGeometry,
  SitePolygon,
  Site
} from "@terramatch-microservices/database/entities";
import { ValidationDto } from "./dto/validation.dto";
import { ValidationRequestDto } from "./dto/validation-request.dto";
import { ValidationResponseDto, ValidationCriteriaDto } from "./dto/validation-criteria.dto";
import { ValidationSummaryDto, ValidationTypeSummary } from "./dto/validation-summary.dto";
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
import { Validator } from "./validators/validator.interface";
import { ValidationType, VALIDATION_CRITERIA_IDS, CriteriaId } from "@terramatch-microservices/database/constants";
import { Op } from "sequelize";
import { TMLogger } from "@terramatch-microservices/common/util/tm-logger";

export const VALIDATORS: Record<ValidationType, Validator> = {
  SELF_INTERSECTION: new SelfIntersectionValidator(),
  POLYGON_SIZE: new PolygonSizeValidator(),
  SPIKES: new SpikesValidator(),
  ESTIMATED_AREA: new EstimatedAreaValidator(),
  DATA_COMPLETENESS: new DataCompletenessValidator(),
  PLANT_START_DATE: new PlantStartDateValidator(),
  OVERLAPPING: new OverlappingValidator(),
  WITHIN_COUNTRY: new WithinCountryValidator()
};

@Injectable()
export class ValidationService {
  private readonly logger = new TMLogger(ValidationService.name);

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
      valid: criteria.valid,
      createdAt: criteria.createdAt,
      extraInfo: criteria.extraInfo
    }));

    const dto = new ValidationDto();
    return populateDto(dto, {
      polygonId: polygonUuid,
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
        polygonId,
        criteriaList: (criteriaByPolygon[polygonId] ?? []).map(criteria => ({
          criteriaId: criteria.criteriaId,
          valid: criteria.valid,
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

  async validatePolygons(request: ValidationRequestDto): Promise<ValidationResponseDto> {
    const results: ValidationCriteriaDto[] = [];

    for (const polygonUuid of request.polygonUuids) {
      for (const validationType of request.validationTypes) {
        const validator = VALIDATORS[validationType];
        if (validator == null) {
          throw new BadRequestException(`Unknown validation type: ${validationType}`);
        }

        const validationResult = await validator.validatePolygon(polygonUuid);
        const criteriaId = this.getCriteriaIdForValidationType(validationType);

        await this.saveValidationResult(polygonUuid, criteriaId, validationResult.valid, validationResult.extraInfo);

        results.push({
          polygonUuid: polygonUuid,
          criteriaId: criteriaId,
          valid: validationResult.valid,
          createdAt: new Date(),
          extraInfo: validationResult.extraInfo
        });
      }
    }

    return { results };
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

      await existingCriteria.update({
        valid,
        extraInfo
      });
    } else {
      const newRecord = new CriteriaSite();
      newRecord.polygonId = polygonUuid;
      newRecord.criteriaId = criteriaId;
      newRecord.valid = valid;
      newRecord.extraInfo = extraInfo;
      await newRecord.save();
    }
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
    for (const polygonUuid of polygonUuids) {
      for (const validationType of validationTypes) {
        const validator = VALIDATORS[validationType];
        if (validator == null) {
          this.logger.warn(`Unknown validation type: ${validationType}`);
          continue;
        }

        try {
          const validationResult = await validator.validatePolygon(polygonUuid);
          const criteriaId = this.getCriteriaIdForValidationType(validationType);

          await this.saveValidationResult(polygonUuid, criteriaId, validationResult.valid, validationResult.extraInfo);
        } catch (error) {
          this.logger.error(`Error validating polygon ${polygonUuid} with ${validationType}:`, error);
          // Continue with next validation instead of failing the entire batch
        }
      }
    }
  }

  async generateValidationSummary(siteUuid: string, validationTypes: ValidationType[]): Promise<ValidationSummaryDto> {
    const polygonUuids = await this.getSitePolygonUuids(siteUuid);

    if (polygonUuids.length === 0) {
      throw new NotFoundException(`No polygons found for site with UUID ${siteUuid}`);
    }

    const validationSummary: Record<ValidationType, ValidationTypeSummary> = {} as Record<
      ValidationType,
      ValidationTypeSummary
    >;

    for (const validationType of validationTypes) {
      const criteriaId = this.getCriteriaIdForValidationType(validationType);

      const criteriaData = await CriteriaSite.findAll({
        where: {
          polygonId: { [Op.in]: polygonUuids },
          criteriaId
        },
        attributes: ["valid"]
      });

      const validCount = criteriaData.filter(c => c.valid === true).length;
      const invalidCount = criteriaData.filter(c => c.valid === false).length;

      validationSummary[validationType] = {
        valid: validCount,
        invalid: invalidCount
      };
    }

    return {
      siteUuid,
      totalPolygons: polygonUuids.length,
      validatedPolygons: polygonUuids.length,
      validationSummary,
      completedAt: new Date()
    };
  }
}

import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import {
  CriteriaSite,
  CriteriaSiteHistoric,
  PolygonGeometry,
  SitePolygon
} from "@terramatch-microservices/database/entities";
import { ValidationDto } from "./dto/validation.dto";
import { ValidationRequestDto } from "./dto/validation-request.dto";
import { ValidationResponseDto, ValidationCriteriaDto } from "./dto/validation-criteria.dto";
import { populateDto } from "@terramatch-microservices/common/dto/json-api-attributes";
import { MAX_PAGE_SIZE } from "@terramatch-microservices/common/util/paginated-query.builder";
import { groupBy } from "lodash";
import { SelfIntersectionValidator } from "./validators/self-intersection.validator";
import { SpikesValidator } from "./validators/spikes.validator";
import { DataCompletenessValidator } from "./validators/data-completeness.validator";
import { Validator } from "./validators/validator.interface";
import { ValidationType, VALIDATION_CRITERIA_IDS, CriteriaId } from "@terramatch-microservices/database/constants";

export const VALIDATORS: Record<ValidationType, Validator> = {
  SELF_INTERSECTION: new SelfIntersectionValidator(),
  SPIKES: new SpikesValidator(),
  DATA_COMPLETENESS: new DataCompletenessValidator()
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
    criteriaId?: number
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
}

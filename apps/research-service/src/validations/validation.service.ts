import { Injectable, NotFoundException } from "@nestjs/common";
import { CriteriaSite, CriteriaSiteHistoric, PolygonGeometry } from "@terramatch-microservices/database/entities";
import { ValidationDto } from "./dto/validation.dto";
import { ValidationRequestDto } from "./dto/validation-request.dto";
import { ValidationResponseDto, ValidationCriteriaDto } from "./dto/validation-response.dto";
import { populateDto } from "@terramatch-microservices/common/dto/json-api-attributes";
import { SelfIntersectionValidator } from "./validators/self-intersection.validator";

@Injectable()
export class ValidationService {
  constructor(private readonly selfIntersectionValidator: SelfIntersectionValidator) {}
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

  async validatePolygons(request: ValidationRequestDto): Promise<ValidationResponseDto> {
    const results: ValidationCriteriaDto[] = [];

    for (const polygonUuid of request.polygonUuids) {
      const validationTypes = request.validationTypes ?? ["SELF_INTERSECTION"];

      for (const validationType of validationTypes) {
        if (validationType === "SELF_INTERSECTION") {
          const validationResult = await this.selfIntersectionValidator.validatePolygon(polygonUuid);

          await this.saveValidationResult(polygonUuid, 4, validationResult.valid, validationResult.extraInfo);

          results.push({
            polygonUuid: polygonUuid,
            criteriaId: 4,
            valid: validationResult.valid,
            extraInfo: validationResult.extraInfo
          });
        }
      }
    }

    return { results };
  }

  private async saveValidationResult(
    polygonUuid: string,
    criteriaId: number,
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

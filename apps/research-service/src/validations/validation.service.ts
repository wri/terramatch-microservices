import { Injectable, NotFoundException } from "@nestjs/common";
import { CriteriaSite, PolygonGeometry } from "@terramatch-microservices/database/entities";
import { ValidationDto } from "./dto/validation.dto";
import { ValidationCriteriaDto } from "./dto/validation-criteria.dto";
import { populateDto } from "@terramatch-microservices/common/dto/json-api-attributes";

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
}

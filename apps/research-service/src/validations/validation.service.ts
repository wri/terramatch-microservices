import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { CriteriaSite, PolygonGeometry, SitePolygon } from "@terramatch-microservices/database/entities";
import { ValidationDto } from "./dto/validation.dto";
import { ValidationCriteriaDto } from "./dto/validation-criteria.dto";
import { populateDto } from "@terramatch-microservices/common/dto/json-api-attributes";
import { MAX_PAGE_SIZE } from "@terramatch-microservices/common/util/paginated-query.builder";

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
    pageSize = MAX_PAGE_SIZE,
    pageNumber = 1
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

    const sitePolygons = await SitePolygon.findAndCountAll({
      where: {
        siteUuid,
        isActive: true
      },
      attributes: ["polygonUuid"],
      limit: pageSize,
      offset: (pageNumber - 1) * pageSize
    });

    if (sitePolygons.count === 0) {
      throw new NotFoundException(`Site with UUID ${siteUuid} not found or has no polygons`);
    }

    const polygonUuids = sitePolygons.rows
      .map(polygon => polygon.polygonUuid)
      .filter(uuid => uuid !== null) as string[];

    const criteriaData = await CriteriaSite.findAll({
      where: { polygonId: polygonUuids },
      attributes: ["polygonId", "criteriaId", "valid", "createdAt", "extraInfo"],
      order: [["createdAt", "DESC"]]
    });

    const criteriaByPolygon: Record<string, ValidationCriteriaDto[]> = {};

    for (const criteria of criteriaData) {
      if (criteria.polygonId === null) continue;

      const polygonId = criteria.polygonId as string;
      criteriaByPolygon[polygonId] = criteriaByPolygon[polygonId] ?? [];

      criteriaByPolygon[polygonId].push({
        criteriaId: criteria.criteriaId,
        valid: criteria.valid,
        createdAt: criteria.createdAt,
        extraInfo: criteria.extraInfo
      });
    }

    const validations: ValidationDto[] = [];

    for (const polygonUuid of polygonUuids) {
      const dto = new ValidationDto();
      populateDto(dto, {
        polygonId: polygonUuid,
        criteriaList: criteriaByPolygon[polygonUuid] ?? []
      });
      validations.push(dto);
    }

    return {
      validations,
      total: sitePolygons.count
    };
  }
}

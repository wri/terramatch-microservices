import { BadRequestException, Controller, Get, NotFoundException, Param, UnauthorizedException } from "@nestjs/common";
import { ApiOperation } from "@nestjs/swagger";
import { ExceptionResponse, JsonApiResponse } from "@terramatch-microservices/common/decorators";
import { PolicyService } from "@terramatch-microservices/common";
import { buildJsonApi } from "@terramatch-microservices/common/util";
import { populateDto } from "@terramatch-microservices/common/dto/json-api-attributes";
import { ENTITY_MODELS } from "@terramatch-microservices/database/constants/entities";
import { intersection } from "lodash";
import { AggregateReportsParamsDto } from "./dto/aggregate-reports-params.dto";
import { AggregateReportsDto } from "./dto/aggregate-reports-response.dto";
import { AggregateReportsService } from "./aggregate-reports.service";

@Controller("entities/v3/:entity/:uuid/aggregateReports")
export class AggregateReportsController {
  constructor(
    private readonly aggregateReportsService: AggregateReportsService,
    private readonly policyService: PolicyService
  ) {}

  @Get()
  @ApiOperation({
    operationId: "getAggregateReports",
    summary: "Get aggregated reporting data for progress charts (tree planting, seeding, regeneration by period)."
  })
  @JsonApiResponse(AggregateReportsDto)
  @ExceptionResponse(BadRequestException, {
    description: "Unsupported entity type or framework."
  })
  @ExceptionResponse(NotFoundException, {
    description: "Entity not found for the given UUID."
  })
  @ExceptionResponse(UnauthorizedException, {
    description: "Current user is not authorized to read this entity."
  })
  async getAggregateReports(@Param() { entity, uuid }: AggregateReportsParamsDto) {
    const modelClass = ENTITY_MODELS[entity];
    if (modelClass == null) {
      throw new BadRequestException(`Unsupported entity type: ${entity}`);
    }

    const attributes = intersection(
      ["id", "frameworkKey", "projectId", "siteId"],
      Object.keys(modelClass.getAttributes())
    );
    const entityModel = await modelClass.findOne({
      where: { uuid },
      attributes
    });

    if (entityModel == null) {
      throw new NotFoundException(`Entity not found for uuid: ${uuid}`);
    }

    await this.policyService.authorize("read", entityModel);

    const attributesData = await this.aggregateReportsService.getAggregateReports(entity, entityModel);
    return buildJsonApi(AggregateReportsDto).addData(
      `${entity}|${uuid}`,
      populateDto(new AggregateReportsDto(), attributesData)
    );
  }
}

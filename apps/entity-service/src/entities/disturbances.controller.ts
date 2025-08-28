import {
  BadRequestException,
  Controller,
  Get,
  InternalServerErrorException,
  NotFoundException,
  Query
} from "@nestjs/common";
import { buildJsonApi, getStableRequestQuery } from "@terramatch-microservices/common/util";
import { ApiOperation } from "@nestjs/swagger";
import { ExceptionResponse, JsonApiResponse } from "@terramatch-microservices/common/decorators";
import { PolicyService } from "@terramatch-microservices/common";
import { DisturbanceQueryDto } from "./dto/disturbance-query.dto";
import { DisturbanceService } from "./disturbance.service";
import { LARAVEL_MODEL_TYPES, LARAVEL_MODELS } from "@terramatch-microservices/database/constants/laravel-types";
import { DisturbanceDto } from "./dto/disturbance.dto";
import { TMLogger } from "@terramatch-microservices/common/util/tm-logger";

@Controller("entities/v3/disturbances")
export class DisturbancesController {
  private logger = new TMLogger(DisturbancesController.name);

  constructor(private readonly disturbanceService: DisturbanceService, private readonly policyService: PolicyService) {}

  @Get()
  @ApiOperation({
    operationId: "disturbanceIndex",
    summary: "Get disturbances."
  })
  @JsonApiResponse([{ data: DisturbanceDto, pagination: "number" }])
  @ExceptionResponse(BadRequestException, { description: "Param types invalid" })
  @ExceptionResponse(NotFoundException, { description: "Records not found" })
  async disturbancesIndex(@Query() params: DisturbanceQueryDto) {
    const { data, paginationTotal, pageNumber } = await this.disturbanceService.getDisturbances(params);
    const document = buildJsonApi(DisturbanceDto, { pagination: "number" });

    if (data.length !== 0) {
      await this.policyService.authorize("read", data);
      for (const disturbance of data) {
        const { disturbanceableType: laravelType, disturbanceableId } = disturbance;
        const model = LARAVEL_MODELS[laravelType];
        if (model == null) {
          this.logger.error("Unknown model type", model);
          throw new InternalServerErrorException("Unexpected disturbance association type");
        }
        const entity = await model.findOne({ where: { id: disturbanceableId }, attributes: ["uuid"] });
        if (entity == null) {
          this.logger.error("Disturbance parent entity not found", { model, id: disturbanceableId });
          throw new NotFoundException();
        }
        const entityType = LARAVEL_MODEL_TYPES[laravelType];
        const additionalProps = { entityType, entityUuid: entity.uuid };
        document.addData(disturbance.uuid, new DisturbanceDto(disturbance, additionalProps));
      }
    }
    return document
      .addIndex({
        requestPath: `/entities/v3/disturbances${getStableRequestQuery(params)}`,
        total: paginationTotal,
        pageNumber: pageNumber
      })
      .serialize();
  }
}

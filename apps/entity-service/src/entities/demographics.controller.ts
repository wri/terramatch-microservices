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
import { TrackingDto } from "@terramatch-microservices/common/dto/tracking.dto";
import { DemographicQueryDto } from "./dto/demographic-query.dto";
import { DemographicService } from "./demographic.service";
import { LARAVEL_MODEL_TYPES, LARAVEL_MODELS } from "@terramatch-microservices/database/constants/laravel-types";
import { TMLogger } from "@terramatch-microservices/common/util/tm-logger";

@Controller("entities/v3/demographics")
export class DemographicsController {
  private logger = new TMLogger(DemographicsController.name);

  constructor(private readonly demographicService: DemographicService, private readonly policyService: PolicyService) {}

  @Get()
  @ApiOperation({
    operationId: "demographicsIndex",
    summary: "Get demographics."
  })
  @JsonApiResponse([{ data: TrackingDto, pagination: "number" }])
  @ExceptionResponse(BadRequestException, { description: "Param types invalid" })
  @ExceptionResponse(NotFoundException, { description: "Records not found" })
  async demographicsIndex(@Query() params: DemographicQueryDto) {
    const { data, paginationTotal, pageNumber } = await this.demographicService.getDemographics(params);
    const document = buildJsonApi(TrackingDto, { pagination: "number" });
    if (data.length !== 0) {
      await this.policyService.authorize("read", data);
      for (const demographic of data) {
        const { trackableType: laravelType, trackableId } = demographic;
        const model = LARAVEL_MODELS[laravelType];
        if (model == null) {
          this.logger.error("Unknown model type", model);
          throw new InternalServerErrorException("Unexpected demographic association type");
        }
        const entity = await model.findOne({ where: { id: trackableId }, attributes: ["uuid"] });
        if (entity == null) {
          this.logger.error("Demographic parent entity not found", { model, id: trackableId });
          throw new NotFoundException();
        }
        const entityType = LARAVEL_MODEL_TYPES[laravelType];
        const additionalProps = { entityType, entityUuid: entity.uuid };
        document.addData(demographic.uuid, new TrackingDto(demographic, additionalProps));
      }
    }
    return document.addIndex({
      requestPath: `/entities/v3/demographics${getStableRequestQuery(params)}`,
      total: paginationTotal,
      pageNumber: pageNumber
    });
  }
}

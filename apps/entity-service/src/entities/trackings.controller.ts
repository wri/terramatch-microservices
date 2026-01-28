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
import { TrackingsQueryDto } from "./dto/trackings-query.dto";
import { TrackingsService } from "./trackings.service";
import { LARAVEL_MODEL_TYPES, LARAVEL_MODELS } from "@terramatch-microservices/database/constants/laravel-types";
import { TMLogger } from "@terramatch-microservices/common/util/tm-logger";

@Controller("entities/v3/trackings")
export class TrackingsController {
  private logger = new TMLogger(TrackingsController.name);

  constructor(private readonly trackingsService: TrackingsService, private readonly policyService: PolicyService) {}

  @Get()
  @ApiOperation({
    operationId: "trackingsIndex",
    summary: "Get trackings."
  })
  @JsonApiResponse([{ data: TrackingDto, pagination: "number" }])
  @ExceptionResponse(BadRequestException, { description: "Param types invalid" })
  @ExceptionResponse(NotFoundException, { description: "Records not found" })
  async index(@Query() params: TrackingsQueryDto) {
    const { data, paginationTotal, pageNumber } = await this.trackingsService.getTrackings(params);
    const document = buildJsonApi(TrackingDto, { pagination: "number" });
    if (data.length !== 0) {
      await this.policyService.authorize("read", data);
      for (const tracking of data) {
        const { trackableType: laravelType, trackableId } = tracking;
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
        document.addData(tracking.uuid, new TrackingDto(tracking, additionalProps));
      }
    }
    return document.addIndex({
      requestPath: `/entities/v3/trackings${getStableRequestQuery(params)}`,
      total: paginationTotal,
      pageNumber: pageNumber
    });
  }
}

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
import { DemographicDto } from "./dto/demographic.dto";
import { DemographicQueryDto } from "./dto/demographic-query.dto";
import { DemographicService } from "./demographic.service";
import { LARAVEL_MODELS } from "@terramatch-microservices/database/constants/laravel-types";
import { TMLogger } from "@terramatch-microservices/common/util/tm-logger";
import { MediaOwnerType } from "@terramatch-microservices/database/constants/media-owners";

@Controller("entities/v3/demographics")
export class DemographicsController {
  private logger = new TMLogger(DemographicsController.name);

  constructor(private readonly demographicService: DemographicService, private readonly policyService: PolicyService) {}

  @Get()
  @ApiOperation({
    operationId: "demographicsIndex",
    summary: "Get demographics."
  })
  @JsonApiResponse([{ data: DemographicDto, pagination: "number" }])
  @ExceptionResponse(BadRequestException, { description: "Param types invalid" })
  @ExceptionResponse(NotFoundException, { description: "Records not found" })
  async demographicsIndex(@Query() params: DemographicQueryDto) {
    const { data, paginationTotal, pageNumber } = await this.demographicService.getDemographics(params);
    const document = buildJsonApi(DemographicDto, { pagination: "number" });
    const indexIds: string[] = [];
    if (data.length !== 0) {
      await this.policyService.authorize("read", data);
      for (const demographic of data) {
        indexIds.push(demographic.uuid);
        const { demographicalType, demographicalId } = demographic;
        const entityType = demographicalType as MediaOwnerType;
        const model = LARAVEL_MODELS[entityType];
        if (model == null) {
          this.logger.error("Unknown model type", entityType);
          throw new InternalServerErrorException("Unexpected demographic association type");
        }
        const entity = await model.findOne({ where: { id: demographicalId }, attributes: ["uuid"] });
        if (entity == null) {
          this.logger.error("Demographic parent entity not found", { entityType, id: demographicalId });
          throw new NotFoundException();
        }
        const additionalProps = { entityType, entityUuid: entity.uuid };
        const demographicDto = new DemographicDto(demographic, additionalProps);
        document.addData(demographicDto.uuid, demographicDto);
      }
    }
    document.addIndexData({
      resource: "demographics",
      requestPath: `/entities/v3/demographics${getStableRequestQuery(params)}`,
      ids: indexIds,
      total: paginationTotal,
      pageNumber: pageNumber
    });
    return document.serialize();
  }
}

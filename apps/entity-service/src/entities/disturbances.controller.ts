import { BadRequestException, Controller, Get, NotFoundException, Query } from "@nestjs/common";
import { buildJsonApi, getStableRequestQuery } from "@terramatch-microservices/common/util";
import { ApiOperation } from "@nestjs/swagger";
import { ExceptionResponse, JsonApiResponse } from "@terramatch-microservices/common/decorators";
import { PolicyService } from "@terramatch-microservices/common";
import { DisturbanceQueryDto } from "./dto/disturbance-query.dto";
import { DisturbanceService } from "./disturbance.service";
import { LARAVEL_MODELS } from "@terramatch-microservices/database/constants/laravel-types";
import { DisturbanceDto } from "./dto/disturbance.dto";

@Controller("entities/v3/disturbances")
export class DisturbancesController {
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
    const indexIds: string[] = [];
    if (data.length !== 0) {
      await this.policyService.authorize("read", data);
      for (const disturbance of data) {
        indexIds.push(disturbance.uuid);
        const model = LARAVEL_MODELS[disturbance.disturbanceableType];
        const disturbanceData = await model.findOne({
          where: { id: disturbance.disturbanceableId },
          attributes: ["id", "uuid"]
        });
        const disturbanceDto = new DisturbanceDto(disturbance, disturbanceData);
        document.addData(disturbanceDto.entityUuid, disturbanceDto);
      }
    }
    document.addIndexData({
      resource: "disturbances",
      requestPath: `/entities/v3/disturbances${getStableRequestQuery(params)}`,
      ids: indexIds,
      total: paginationTotal,
      pageNumber: pageNumber
    });
    return document.serialize();
  }
}

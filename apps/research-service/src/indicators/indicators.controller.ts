import { Body, Controller, Param, Post, Request } from "@nestjs/common";
import { ApiExtraModels, ApiOperation } from "@nestjs/swagger";
import { IndicatorTreeCoverDto, IndicatorTreeCoverLossDto } from "../site-polygons/dto/indicators.dto";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { DelayedJob } from "@terramatch-microservices/database/entities/delayed-job.entity";
import { JsonApiResponse } from "@terramatch-microservices/common/decorators/json-api-response.decorator";
import { buildDelayedJobResponse } from "@terramatch-microservices/common/util";
import { DelayedJobDto } from "@terramatch-microservices/common/dto/delayed-job.dto";
import { IndicatorsSummaryDto } from "./dto/Indicators-summary.dto";
import { IndicatorsBodyDto } from "./dto/indicators-body.dto";
import { TMLogger } from "@terramatch-microservices/common/util/tm-logger";
import { IndicatorsParamDto } from "./dto/indicators-param.dto";
import { IndicatorHectaresDto } from "../site-polygons/dto/indicators.dto";
import { SitePolygonLightDto } from "../site-polygons/dto/site-polygon.dto";

@Controller("research/v3/indicators")
@ApiExtraModels(IndicatorTreeCoverLossDto, IndicatorHectaresDto)
export class IndicatorsController {
  private readonly logger = new TMLogger(IndicatorsController.name);

  constructor(@InjectQueue("sitePolygons") private readonly indicatorsQueue: Queue) {}

  @Post(":slug")
  @ApiOperation({
    operationId: "startIndicatorCalculation",
    summary: "Start indicator calculation"
  })
  @JsonApiResponse([DelayedJobDto, SitePolygonLightDto])
  async startIndicatorCalculation(
    @Param() { slug }: IndicatorsParamDto,
    @Body() payload: IndicatorsBodyDto,
    @Request() { authenticatedUserId }
  ) {
    this.logger.debug(`Starting indicator calculation for slug: ${slug}`);

    const delayedJob = await DelayedJob.create({
      isAcknowledged: false,
      name: "Indicator Calculation",
      processedContent: 0,
      progressMessage: "Starting indicator calculation...",
      createdBy: authenticatedUserId,
      metadata: {}
    } as DelayedJob);

    await this.indicatorsQueue.add("indicatorCalculation", {
      slug,
      ...payload.data.attributes,
      delayedJobId: delayedJob.id
    });

    return buildDelayedJobResponse(delayedJob);
  }
}

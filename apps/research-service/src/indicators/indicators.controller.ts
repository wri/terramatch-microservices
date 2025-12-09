import { Body, Controller, Get, Param, Post, Request, Type, UnauthorizedException } from "@nestjs/common";
import { ApiExtraModels, ApiOperation } from "@nestjs/swagger";
import {
  IndicatorFieldMonitoringDto,
  IndicatorHectaresDto,
  IndicatorMsuCarbonDto,
  IndicatorTreeCountDto,
  IndicatorTreeCoverDto,
  IndicatorTreeCoverLossDto,
  INDICATOR_DTOS
} from "../site-polygons/dto/indicators.dto";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { DelayedJob, SitePolygon } from "@terramatch-microservices/database/entities";
import { JsonApiResponse } from "@terramatch-microservices/common/decorators/json-api-response.decorator";
import { buildDelayedJobResponse, buildJsonApi } from "@terramatch-microservices/common/util";
import { DelayedJobDto } from "@terramatch-microservices/common/dto/delayed-job.dto";
import { IndicatorsSummaryDto } from "./dto/Indicators-summary.dto";
import { IndicatorsBodyDto } from "./dto/indicators-body.dto";
import { TMLogger } from "@terramatch-microservices/common/util/tm-logger";
import { IndicatorsParamDto } from "./dto/indicators-param.dto";
import { IndicatorsGetParamsDto } from "./dto/indicators-get-params.dto";
import { IndicatorsService } from "./indicators.service";
import { PolicyService } from "@terramatch-microservices/common";
import { ExceptionResponse } from "@terramatch-microservices/common/decorators";
import { NotFoundException } from "@nestjs/common";

@Controller("research/v3/indicators")
@ApiExtraModels(
  IndicatorTreeCoverLossDto,
  IndicatorHectaresDto,
  IndicatorTreeCountDto,
  IndicatorTreeCoverDto,
  IndicatorFieldMonitoringDto,
  IndicatorMsuCarbonDto
)
export class IndicatorsController {
  private readonly logger = new TMLogger(IndicatorsController.name);

  constructor(
    @InjectQueue("indicators") private readonly indicatorsQueue: Queue,
    private readonly indicatorsService: IndicatorsService,
    private readonly policyService: PolicyService
  ) {}

  @Post(":slug")
  @ApiOperation({
    operationId: "startIndicatorCalculation",
    summary: "Start indicator calculation"
  })
  @JsonApiResponse([IndicatorsSummaryDto, DelayedJobDto])
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

  @Get(":entity/:uuid/:slug")
  @ApiOperation({
    operationId: "getIndicatorData",
    summary: "Get indicator data for a specific entity and indicator slug",
    description: "Retrieves all indicator records matching the specified slug for the given entity (site polygon)."
  })
  @JsonApiResponse([
    IndicatorTreeCoverLossDto,
    IndicatorHectaresDto,
    IndicatorTreeCountDto,
    IndicatorTreeCoverDto,
    IndicatorFieldMonitoringDto,
    IndicatorMsuCarbonDto
  ])
  @ExceptionResponse(UnauthorizedException, { description: "Authentication failed." })
  @ExceptionResponse(NotFoundException, { description: "Entity not found or no indicator data available." })
  async getIndicatorData(@Param() params: IndicatorsGetParamsDto) {
    const { entity, uuid, slug } = params;

    if (entity !== "sitePolygon") {
      throw new NotFoundException(`Entity type '${entity}' is not supported. Only 'sitePolygon' is supported.`);
    }

    // Find site polygon for authorization check
    const sitePolygon = await SitePolygon.findOne({ where: { uuid } });
    if (sitePolygon == null) {
      throw new NotFoundException(`Site polygon not found for UUID: ${uuid}`);
    }

    await this.policyService.authorize("read", sitePolygon);

    const indicatorData = await this.indicatorsService.getIndicatorData(uuid, slug);

    if (indicatorData.length === 0) {
      throw new NotFoundException(`No indicator data found for slug '${slug}' and entity UUID '${uuid}'`);
    }

    // Determine the DTO type based on the slug
    const DtoClass = INDICATOR_DTOS[slug];
    if (DtoClass == null) {
      throw new NotFoundException(`Unknown indicator slug: ${slug}`);
    }

    const document = buildJsonApi(DtoClass as Type<unknown>, { forceDataArray: true });
    indicatorData.forEach((indicator, index) => {
      document.addData(`${uuid}-${slug}-${index}`, indicator);
    });

    document.addIndex({
      requestPath: `/research/v3/indicators/${entity}/${uuid}/${slug}`,
      total: indicatorData.length
    });

    return document;
  }
}

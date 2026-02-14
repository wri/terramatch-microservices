import { Body, Controller, Get, Header, Param, Post, Request, UnauthorizedException } from "@nestjs/common";
import { ApiExtraModels, ApiOperation, ApiResponse } from "@nestjs/swagger";
import { IndicatorHectaresDto, IndicatorTreeCoverLossDto } from "../site-polygons/dto/indicators.dto";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { DelayedJob } from "@terramatch-microservices/database/entities";
import { JsonApiResponse } from "@terramatch-microservices/common/decorators/json-api-response.decorator";
import { buildDelayedJobResponse } from "@terramatch-microservices/common/util";
import { DelayedJobDto } from "@terramatch-microservices/common/dto/delayed-job.dto";
import { IndicatorsBodyDto } from "./dto/indicators-body.dto";
import { TMLogger } from "@terramatch-microservices/common/util/tm-logger";
import { IndicatorsParamDto } from "./dto/indicators-param.dto";
import { SitePolygonLightDto } from "../site-polygons/dto/site-polygon.dto";
import { IndicatorsService } from "./indicators.service";
import { ExceptionResponse } from "@terramatch-microservices/common/decorators";
import { IndicatorExportQueryDto } from "./dto/indicator-export-query.dto";

@Controller("research/v3/indicators")
@ApiExtraModels(IndicatorTreeCoverLossDto, IndicatorHectaresDto)
export class IndicatorsController {
  private readonly logger = new TMLogger(IndicatorsController.name);

  constructor(
    @InjectQueue("sitePolygons") private readonly sitePolygonsQueue: Queue,
    private readonly indicatorsService: IndicatorsService
  ) {}

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

    const { polygonUuids } = payload.data.attributes;

    const delayedJob = await DelayedJob.create({
      isAcknowledged: false,
      name: "Indicator Calculation",
      processedContent: 0,
      progressMessage: "Starting indicator calculation...",
      createdBy: authenticatedUserId,
      metadata: {
        entity_name: `${polygonUuids.length} polygons`
      }
    } as DelayedJob);

    await this.sitePolygonsQueue.add("indicatorCalculation", {
      slug,
      ...payload.data.attributes,
      delayedJobId: delayedJob.id
    });

    return buildDelayedJobResponse(delayedJob);
  }

  @Get("export/:entityType/:entityUuid/:slug")
  @ApiOperation({
    operationId: "exportIndicatorCsv",
    summary: "Export indicator data as CSV",
    description: `Export indicator data for a site or project as a CSV file.
    Supports: treeCoverLoss, treeCoverLossFires, restorationByStrategy, restorationByLandUse, restorationByEcoRegion, treeCover`
  })
  @ApiResponse({
    status: 200,
    description: "CSV file content",
    content: {
      "text/csv": {
        schema: {
          type: "string",
          example:
            "Polygon Name,Size (ha),Site Name,Status,Plant Start Date,2020,2021\nPolygon 1,100.5,Site A,approved,2020-01-01,0.5,0.3"
        }
      }
    }
  })
  @ExceptionResponse(UnauthorizedException, { description: "Authentication failed" })
  @Header("Content-Type", "text/csv")
  @Header("Content-Disposition", "attachment; filename=indicator-export.csv")
  async exportIndicator(@Param() { entityType, entityUuid, slug }: IndicatorExportQueryDto): Promise<string> {
    return await this.indicatorsService.exportIndicatorToCsv(entityType, entityUuid, slug);
  }
}

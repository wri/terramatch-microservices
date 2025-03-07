import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Patch,
  Query,
  UnauthorizedException
} from "@nestjs/common";
import { buildJsonApi, JsonApiDocument } from "@terramatch-microservices/common/util";
import { ApiExtraModels, ApiOkResponse, ApiOperation } from "@nestjs/swagger";
import { ExceptionResponse, JsonApiResponse } from "@terramatch-microservices/common/decorators";
import { SitePolygonDto } from "./dto/site-polygon.dto";
import { SitePolygonQueryDto } from "./dto/site-polygon-query.dto";
import {
  IndicatorFieldMonitoringDto,
  IndicatorHectaresDto,
  IndicatorMsuCarbonDto,
  IndicatorTreeCountDto,
  IndicatorTreeCoverDto,
  IndicatorTreeCoverLossDto
} from "./dto/indicators.dto";
import { SitePolygonBulkUpdateBodyDto } from "./dto/site-polygon-update.dto";
import { SitePolygonsService } from "./site-polygons.service";
import { PolicyService } from "@terramatch-microservices/common";
import { SitePolygon } from "@terramatch-microservices/database/entities";

const MAX_PAGE_SIZE = 100 as const;

@Controller("research/v3/sitePolygons")
@ApiExtraModels(
  IndicatorTreeCoverLossDto,
  IndicatorHectaresDto,
  IndicatorTreeCountDto,
  IndicatorTreeCoverDto,
  IndicatorFieldMonitoringDto,
  IndicatorMsuCarbonDto
)
export class SitePolygonsController {
  constructor(
    private readonly sitePolygonService: SitePolygonsService,
    private readonly policyService: PolicyService
  ) {}

  @Get()
  @ApiOperation({ operationId: "sitePolygonsIndex", summary: "Get all site polygons" })
  @JsonApiResponse({ data: SitePolygonDto, pagination: "cursor" })
  @ExceptionResponse(UnauthorizedException, { description: "Authentication failed." })
  @ExceptionResponse(BadRequestException, { description: "One or more query param values is invalid." })
  async findMany(@Query() query: SitePolygonQueryDto): Promise<JsonApiDocument> {
    await this.policyService.authorize("readAll", SitePolygon);

    const { siteId, projectId, includeTestProjects } = query;
    const countSelectedParams = [siteId, projectId, includeTestProjects].filter(param => param != null).length;

    if (countSelectedParams > 1) {
      throw new BadRequestException(
        "Only one of siteId, projectId, and includeTestProjects may be used in a single request."
      );
    }

    const { size: pageSize = MAX_PAGE_SIZE, after: pageAfter } = query.page ?? {};
    if (pageSize > MAX_PAGE_SIZE || pageSize < 1) {
      throw new BadRequestException("Page size is invalid");
    }

    const queryBuilder = (await this.sitePolygonService.buildQuery(pageSize, pageAfter))
      .hasStatuses(query.polygonStatus)
      .modifiedSince(query.lastModifiedDate)
      .isMissingIndicators(query.missingIndicator);

    await queryBuilder.touchesBoundary(query.boundaryPolygon);

    if (query.siteId != null) {
      await queryBuilder.filterSiteUuids(query.siteId);
    } else if (query.projectId != null) {
      await queryBuilder.filterProjectUuids(query.projectId);
    } else if (query.includeTestProjects !== true) {
      await queryBuilder.excludeTestProjects();
    }

    const document = buildJsonApi(SitePolygonDto, { pagination: "cursor" });
    for (const sitePolygon of await queryBuilder.execute()) {
      const indicators = await this.sitePolygonService.getIndicators(sitePolygon);
      const establishmentTreeSpecies = await this.sitePolygonService.getEstablishmentTreeSpecies(sitePolygon);
      const reportingPeriods = await this.sitePolygonService.getReportingPeriods(sitePolygon);
      document.addData(
        sitePolygon.uuid,
        new SitePolygonDto(
          sitePolygon,
          sitePolygon.polygon?.polygon,
          indicators,
          establishmentTreeSpecies,
          reportingPeriods,
          sitePolygon.site?.name
        )
      );
    }

    return document.serialize({ paginationTotal: await queryBuilder.paginationTotal() });
  }

  @Patch()
  @ApiOperation({
    operationId: "bulkUpdateSitePolygons",
    summary: "Update indicators for site polygons",
    description: `If an indicator is provided that already exists, it will be updated with the value in the
       payload. If a new indicator is provided, it will be created in the DB. Indicators are keyed
       off of the combination of site polygon ID, indicatorSlug, and yearOfAnalysis.`
  })
  @ApiOkResponse()
  @ExceptionResponse(UnauthorizedException, { description: "Authentication failed." })
  @ExceptionResponse(BadRequestException, { description: "One or more of the data payload members has a problem." })
  @ExceptionResponse(NotFoundException, { description: "A site polygon specified in the data was not found." })
  async bulkUpdate(@Body() updatePayload: SitePolygonBulkUpdateBodyDto): Promise<void> {
    await this.policyService.authorize("updateAll", SitePolygon);

    await this.sitePolygonService.transaction(async transaction => {
      const updates: Promise<void>[] = [];
      for (const update of updatePayload.data) {
        for (const indicator of update.attributes.indicators) {
          updates.push(this.sitePolygonService.updateIndicator(update.id, indicator, transaction));
        }
      }

      await Promise.all(updates);
    });
  }
}

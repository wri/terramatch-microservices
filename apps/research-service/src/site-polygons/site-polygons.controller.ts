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
import { buildJsonApi, JsonApiDocument, SerializeOptions } from "@terramatch-microservices/common/util";
import { ApiExtraModels, ApiOkResponse, ApiOperation } from "@nestjs/swagger";
import { ExceptionResponse, JsonApiResponse } from "@terramatch-microservices/common/decorators";
import { SitePolygonFullDto, SitePolygonLightDto } from "./dto/site-polygon.dto";
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
import { isNumberPage } from "@terramatch-microservices/common/dto/page.dto";

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
  @JsonApiResponse({ data: SitePolygonFullDto, pagination: "cursor" })
  @ExceptionResponse(UnauthorizedException, { description: "Authentication failed." })
  @ExceptionResponse(BadRequestException, { description: "One or more query param values is invalid." })
  async findMany(@Query() query: SitePolygonQueryDto): Promise<JsonApiDocument> {
    await this.policyService.authorize("readAll", SitePolygon);

    const { siteId, projectId, includeTestProjects, missingIndicator, presentIndicator, isLightData } = query;

    const countSelectedParams = [siteId, projectId, includeTestProjects].filter(param => param != null).length;

    if (countSelectedParams > 1) {
      throw new BadRequestException(
        "Only one of siteId, projectId, and includeTestProjects may be used in a single request."
      );
    }
    if (missingIndicator != null && presentIndicator != null) {
      throw new BadRequestException(
        "Only one of missingIndicator[] or presentIndicator[] may be used in a single request."
      );
    }

    const page = query.page ?? {};
    page.size ??= MAX_PAGE_SIZE;
    if (page.size > MAX_PAGE_SIZE || page.size < 1) {
      throw new BadRequestException("Page size is invalid");
    }

    if (isNumberPage(page) && page.number < 1) {
      throw new BadRequestException("Page number is invalid");
    }

    const queryBuilder = (await this.sitePolygonService.buildQuery(page))
      .hasStatuses(query.polygonStatus)
      .modifiedSince(query.lastModifiedDate);

    if (missingIndicator) {
      queryBuilder.isMissingIndicators(missingIndicator);
    } else if (presentIndicator) {
      queryBuilder.hasPresentIndicators(presentIndicator);
    }
    await queryBuilder.touchesBoundary(query.boundaryPolygon);

    if (query.siteId != null) {
      await queryBuilder.filterSiteUuids(query.siteId);
    }

    if (query.projectId != null) {
      await queryBuilder.filterProjectUuids(query.projectId);
    }

    // Ensure test projects are excluded only if not included explicitly
    if (!query.includeTestProjects && query.siteId == null && query.projectId == null) {
      await queryBuilder.excludeTestProjects();
    }
    const document = buildJsonApi(SitePolygonFullDto, { pagination: isNumberPage(query.page) ? "number" : "cursor" });
    for (const sitePolygon of await queryBuilder.execute()) {
      const indicators = await this.sitePolygonService.getIndicators(sitePolygon);
      if (isLightData) {
        document.addData(sitePolygon.uuid, new SitePolygonLightDto(sitePolygon, indicators));
      } else {
        const establishmentTreeSpecies = await this.sitePolygonService.getEstablishmentTreeSpecies(sitePolygon);
        const reportingPeriods = await this.sitePolygonService.getReportingPeriods(sitePolygon);

        document.addData(
          sitePolygon.uuid,
          new SitePolygonFullDto(sitePolygon, indicators, establishmentTreeSpecies, reportingPeriods)
        );
      }
    }

    const serializeOptions: SerializeOptions = { paginationTotal: await queryBuilder.paginationTotal() };
    if (isNumberPage(query.page)) serializeOptions.pageNumber = query.page.number;
    return document.serialize(serializeOptions);
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

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
import {
  buildJsonApi,
  getDtoType,
  getStableRequestQuery,
  IndexData,
  JsonApiDocument
} from "@terramatch-microservices/common/util";
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
  @JsonApiResponse([
    { data: SitePolygonFullDto, pagination: "cursor" },
    { data: SitePolygonLightDto, pagination: "number" }
  ])
  @ExceptionResponse(UnauthorizedException, { description: "Authentication failed." })
  @ExceptionResponse(BadRequestException, { description: "One or more query param values is invalid." })
  async findMany(@Query() query: SitePolygonQueryDto): Promise<JsonApiDocument> {
    await this.policyService.authorize("readAll", SitePolygon);

    const { siteId, projectId, includeTestProjects, missingIndicator, presentIndicator, lightResource, projectCohort } =
      query;
    let countSelectedParams = [siteId, projectId].filter(param => param != null).length;
    if (includeTestProjects) countSelectedParams++;
    if (projectCohort != null) countSelectedParams++;

    if (lightResource && !isNumberPage(query.page)) {
      throw new BadRequestException("Light resources must use number pagination.");
    }

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

    if (missingIndicator != null && missingIndicator.length > 0) {
      queryBuilder.isMissingIndicators(missingIndicator);
    } else if (presentIndicator != null && presentIndicator.length > 0) {
      queryBuilder.hasPresentIndicators(presentIndicator);
    }

    if (query.boundaryPolygon != null) {
      await queryBuilder.touchesLandscape(query.boundaryPolygon);
    }

    if (siteId != null) {
      await queryBuilder.filterSiteUuids(siteId);
    }

    if (projectId != null) {
      await queryBuilder.filterProjectUuids(projectId);
    }

    if (projectCohort != null) {
      await queryBuilder.filterProjectCohort(projectCohort);
    }

    // Ensure test projects are excluded only if not included explicitly
    if (!includeTestProjects && siteId == null && projectId == null) {
      await queryBuilder.excludeTestProjects();
    }
    if (query.search != null) {
      await queryBuilder.addSearch(query.search);
    }
    const dtoType = lightResource ? SitePolygonLightDto : SitePolygonFullDto;

    const indexIds: string[] = [];
    const document = buildJsonApi(dtoType, { pagination: isNumberPage(query.page) ? "number" : "cursor" });
    for (const sitePolygon of await queryBuilder.execute()) {
      indexIds.push(sitePolygon.uuid);
      if (lightResource) {
        document.addData(sitePolygon.uuid, await this.sitePolygonService.buildLightDto(sitePolygon));
      } else {
        document.addData(sitePolygon.uuid, await this.sitePolygonService.buildFullDto(sitePolygon));
      }
    }

    const indexData: IndexData = {
      resource: getDtoType(dtoType),
      requestPath: `/research/v3/sitePolygons${getStableRequestQuery(query)}`,
      ids: indexIds,
      total: await queryBuilder.paginationTotal()
    };
    if (isNumberPage(query.page)) indexData.pageNumber = query.page.number;
    else indexData.cursor = indexIds[0];
    document.addIndexData(indexData);

    return document.serialize();
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

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
import { buildJsonApi, getStableRequestQuery, IndexData, JsonApiDocument } from "@terramatch-microservices/common/util";
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

    const {
      siteId,
      projectId,
      projectShortNames,
      includeTestProjects,
      missingIndicator,
      presentIndicator,
      lightResource,
      projectCohort,
      landscape,
      validationStatus,
      polygonUuid
    } = query;
    let countSelectedParams = [siteId, projectId].filter(param => param != null).length;
    // these two can be used together, but not along with the other project / site filters.
    if (projectCohort != null || landscape != null) countSelectedParams++;

    if (lightResource && !isNumberPage(query.page)) {
      throw new BadRequestException("Light resources must use number pagination.");
    }

    if (countSelectedParams > 1) {
      throw new BadRequestException(
        "Only one of siteId, projectId, projectCohort, landscape, and includeTestProjects may be used in a single request."
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

    if (siteId != null) {
      await queryBuilder.filterSiteUuids(siteId);
    }

    if (projectId != null) {
      await queryBuilder.filterProjectUuids(projectId);
    }

    if (projectShortNames != null) {
      await queryBuilder.filterProjectShortNames(projectShortNames);
    }

    if (validationStatus != null) {
      await queryBuilder.filterValidationStatus(validationStatus);
    }

    if (projectCohort != null || landscape != null) {
      await queryBuilder.filterProjectAttributes(projectCohort, landscape);
    }

    if (polygonUuid != null) {
      await queryBuilder.filterPolygonUuids(polygonUuid);
    }

    // Ensure test projects are excluded only if not included explicitly
    if (!includeTestProjects && siteId == null && projectId == null) {
      await queryBuilder.excludeTestProjects();
    }
    if (query.search != null) {
      await queryBuilder.addSearch(query.search);
    }

    if (query.sort != null && query.sort.field != null) {
      if (!isNumberPage(page)) {
        throw new BadRequestException("Sorting is only supported with number pagination.");
      }
      const direction = query.sort.direction ?? "ASC";
      const field = query.sort.field;
      if (["name", "status", "createdAt"].includes(field)) {
        if (field === "name") {
          queryBuilder.order(["polyName", direction]);
        } else if (field === "status") {
          queryBuilder.order(["status", direction]);
        } else {
          queryBuilder.order(["createdAt", direction]);
        }
      } else {
        throw new BadRequestException(`Invalid sort field: ${field}`);
      }
    }

    const dtoType = lightResource ? SitePolygonLightDto : SitePolygonFullDto;

    const document = buildJsonApi(dtoType, { pagination: isNumberPage(query.page) ? "number" : "cursor" });
    const sitePolygons = await queryBuilder.execute();
    const associations = await this.sitePolygonService.loadAssociationDtos(sitePolygons, lightResource ?? false);
    let cursor: string | undefined = undefined;
    for (const sitePolygon of sitePolygons) {
      if (cursor == null) cursor = sitePolygon.uuid;
      if (lightResource) {
        document.addData(
          sitePolygon.uuid,
          await this.sitePolygonService.buildLightDto(sitePolygon, associations[sitePolygon.id] ?? {})
        );
      } else {
        document.addData(
          sitePolygon.uuid,
          await this.sitePolygonService.buildFullDto(sitePolygon, associations[sitePolygon.id] ?? {})
        );
      }
    }

    const indexData: Partial<IndexData> & { requestPath: string } = {
      requestPath: `/research/v3/sitePolygons${getStableRequestQuery(query)}`,
      total: await queryBuilder.paginationTotal()
    };
    if (isNumberPage(query.page)) indexData.pageNumber = query.page.number;
    else indexData.cursor = cursor;
    return document.addIndex(indexData).serialize();
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

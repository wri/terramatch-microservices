import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotImplementedException,
  Patch,
  Query,
  UnauthorizedException
} from "@nestjs/common";
import { buildJsonApi, JsonApiDocument } from "@terramatch-microservices/common/util";
import { ApiExtraModels, ApiOkResponse, ApiOperation } from "@nestjs/swagger";
import { ApiException } from "@nanogiants/nestjs-swagger-api-exception-decorator";
import { JsonApiResponse } from "@terramatch-microservices/common/decorators";
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

const DEFAULT_PAGE_SIZE = 100 as const;

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
  constructor(private readonly sitePolygonService: SitePolygonsService) {}

  @Get()
  @ApiOperation({ operationId: "sitePolygonsIndex", summary: "Get all site polygons" })
  @JsonApiResponse({ data: { type: SitePolygonDto }, hasMany: true, pagination: true })
  @ApiException(() => UnauthorizedException, { description: "Authentication failed." })
  @ApiException(() => BadRequestException, { description: "Pagination values are invalid." })
  async findMany(@Query() query?: SitePolygonQueryDto): Promise<JsonApiDocument> {
    const { size: pageSize = DEFAULT_PAGE_SIZE, after: pageAfter } = query.page ?? {};
    if (pageSize > DEFAULT_PAGE_SIZE || pageSize < 1) {
      throw new BadRequestException("Page size is invalid");
    }

    const builder = await this.sitePolygonService.buildQuery(pageSize, pageAfter);

    const document = buildJsonApi();
    for (const sitePolygon of await builder.execute()) {
      const indicators = await this.sitePolygonService.convertIndicators(sitePolygon);
      const establishmentTreeSpecies = await this.sitePolygonService.getEstablishmentTreeSpecies(sitePolygon);
      document.addData(sitePolygon.uuid, new SitePolygonDto(sitePolygon, indicators, establishmentTreeSpecies));
    }
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
  @ApiException(() => UnauthorizedException, { description: "Authentication failed." })
  async bulkUpdate(@Body() updatePayload: SitePolygonBulkUpdateBodyDto): Promise<void> {
    throw new NotImplementedException();
  }
}

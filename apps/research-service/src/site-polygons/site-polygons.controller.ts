import {
  BadRequestException, Body,
  Controller,
  Get,
  NotImplementedException, Patch,
  Query,
  UnauthorizedException
} from '@nestjs/common';
import { JsonApiDocument } from '@terramatch-microservices/common/util';
import { ApiExtraModels, ApiOkResponse, ApiOperation } from '@nestjs/swagger';
import { ApiException } from '@nanogiants/nestjs-swagger-api-exception-decorator';
import { JsonApiResponse } from '@terramatch-microservices/common/decorators';
import { SitePolygonDto } from './dto/site-polygon.dto';
import { SitePolygonQueryDto } from './dto/site-polygon-query.dto';
import {
  IndicatorFieldMonitoringDto,
  IndicatorHectaresDto,
  IndicatorMsuCarbonDto,
  IndicatorTreeCountDto,
  IndicatorTreeCoverDto,
  IndicatorTreeCoverLossDto,
} from './dto/indicators.dto';
import { SitePolygonBulkUpdateBodyDto } from './dto/site-polygon-update.dto';

@Controller('research/v3/sitePolygons')
@ApiExtraModels(
  IndicatorTreeCoverLossDto,
  IndicatorHectaresDto,
  IndicatorTreeCountDto,
  IndicatorTreeCoverDto,
  IndicatorFieldMonitoringDto,
  IndicatorMsuCarbonDto
)
export class SitePolygonsController {
  @Get()
  @ApiOperation({ operationId: 'sitePolygonsIndex', summary: 'Get all site polygons' })
  @JsonApiResponse({ data: { type: SitePolygonDto }, hasMany: true, pagination: true })
  @ApiException(() => UnauthorizedException, { description: 'Authentication failed.' })
  @ApiException(() => BadRequestException, { description: 'Pagination values are invalid.' })
  async findMany(
    @Query() query?: SitePolygonQueryDto
  ): Promise<JsonApiDocument> {
    throw new NotImplementedException();
  }

  @Patch()
  @ApiOperation({
    operationId: 'bulkUpdateSitePolygons',
    summary: 'Update indicators for site polygons',
    description:
      `If an indicator is provided that already exists, it will be updated with the value in the
       payload. If a new indicator is provided, it will be created in the DB. Indicators are keyed
       off of the combination of site polygon ID, indicatorSlug, and yearOfAnalysis.`
  })
  @ApiOkResponse()
  @ApiException(() => UnauthorizedException, { description: 'Authentication failed.' })
  async bulkUpdate(
    @Body() updatePayload: SitePolygonBulkUpdateBodyDto
  ): Promise<void> {
    throw new NotImplementedException();
  }
}

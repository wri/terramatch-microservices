import {
  BadRequestException,
  Controller,
  Get,
  NotImplementedException,
  Query,
  UnauthorizedException
} from '@nestjs/common';
import { JsonApiDocument } from '@terramatch-microservices/common/util';
import { ApiOperation } from '@nestjs/swagger';
import { ApiException } from '@nanogiants/nestjs-swagger-api-exception-decorator';
import { JsonApiResponse } from '@terramatch-microservices/common/decorators';
import { SitePolygonDto } from './dto/site-polygon.dto';
import { SitePolygonQueryDto } from './dto/site-polygon-query.dto';

@Controller('research/v3/sitePolygons')
export class SitePolygonsController {
  @Get()
  @ApiOperation({ operationId: 'sitePolygonsIndex', summary: 'Get all site polygons' })
  @JsonApiResponse({ data: { type: SitePolygonDto }, hasMany: true, pagination: true })
  @ApiException(() => UnauthorizedException, { description: 'Authentication failed.' })
  @ApiException(() => BadRequestException, { description: 'Pagination values are invalid.' })
  async findMany(@Query() query?: SitePolygonQueryDto): Promise<JsonApiDocument> {
    throw new NotImplementedException();
  }
}

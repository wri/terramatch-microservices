import { Controller, Post, Body, Query, BadRequestException } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse } from "@nestjs/swagger";
import { GeometryService } from "./geometry.service";
import { GeometryRequestDto, GeometryQueryDto, GeometryResponseDto } from "./dto";
@Controller("research/v3/geometry")
@ApiTags("Geometry")
export class GeometryController {
  constructor(private readonly geometryService: GeometryService) {}

  @Post()
  @ApiOperation({
    operationId: "geometryCreate",
    summary: "Create geometries from GeoJSON FeatureCollections",
    description: "Unified endpoint for creating Point and Polygon geometries with configurable processing options"
  })
  @ApiResponse({
    status: 201,
    description: "Geometries processed successfully",
    type: [GeometryResponseDto]
  })
  async createGeometry(
    @Body() request: GeometryRequestDto,
    @Query() query: GeometryQueryDto
  ): Promise<GeometryResponseDto[]> {
    try {
      if (request.geometries == null || request.geometries.length === 0) {
        throw new BadRequestException("At least one FeatureCollection is required");
      }

      const results = await this.geometryService.processGeometries(request.geometries, {
        extractProperties: query.extract_properties ?? true,
        validate: query.validate ?? true,
        preserveStatus: query.preserve_status ?? true
      });

      return results;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(`Failed to process geometries: ${error.message}`);
    }
  }
}

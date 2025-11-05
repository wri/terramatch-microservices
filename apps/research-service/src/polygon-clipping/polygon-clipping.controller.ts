import {
  Body,
  Controller,
  NotFoundException,
  Post,
  UnauthorizedException,
  BadRequestException,
  Param
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { ExceptionResponse } from "@terramatch-microservices/common/decorators";
import { PolygonClippingService } from "./polygon-clipping.service";
import { PolygonListClippingRequestBody } from "./dto/clip-polygon-request.dto";
import { PolicyService } from "@terramatch-microservices/common";
import { SitePolygon } from "@terramatch-microservices/database/entities";

@ApiTags("Polygon Clipping")
@Controller("polygonClipping/v3")
export class PolygonClippingController {
  constructor(
    private readonly clippingService: PolygonClippingService,
    private readonly policyService: PolicyService
  ) {}

  // These endpoints do NOT modify the database as we do not create new versions yet. It is here for testing clipping logic.

  @Post("sites/:siteUuid/clippedPolygons")
  @ApiOperation({
    operationId: "createSitePolygonClipping",
    summary: "Create polygon clipping for a site",
    description: `Finds and clips all fixable overlapping polygons in a site (overlap ≤3.5% AND ≤0.118 hectares).
      Returns GeoJSON of original and clipped polygons for verification.`
  })
  @ExceptionResponse(UnauthorizedException, { description: "Authentication failed." })
  @ExceptionResponse(NotFoundException, { description: "Site not found or no fixable overlapping polygons." })
  @ExceptionResponse(BadRequestException, { description: "Invalid request data." })
  async createSitePolygonClipping(@Param("siteUuid") siteUuid: string) {
    await this.policyService.authorize("readAll", SitePolygon);

    const fixablePolygons = await this.clippingService.getFixablePolygonsForSite(siteUuid);

    if (fixablePolygons.length === 0) {
      throw new NotFoundException(`No fixable overlapping polygons found for site ${siteUuid}`);
    }

    const originalGeometries = await this.clippingService.getOriginalGeometriesGeoJson(fixablePolygons);

    const clippedResults = await this.clippingService.clipPolygons(fixablePolygons);
    const clippedGeometries = this.clippingService.buildGeoJsonResponse(clippedResults);

    return {
      originalGeometries,
      clippedGeometries,
      summary: {
        totalPolygonsProcessed: fixablePolygons.length,
        polygonsClipped: clippedResults.length,
        message: `Successfully processed ${fixablePolygons.length} polygons, clipped ${clippedResults.length} polygons`
      }
    };
  }

  @Post("projects/:siteUuid/clippedPolygons")
  @ApiOperation({
    operationId: "createProjectPolygonClipping",
    summary: "Create polygon clipping for a project",
    description: `Finds all polygons in a project (via site UUID) and clips fixable overlaps (≤3.5% AND ≤0.118 hectares).
      Returns GeoJSON of original and clipped polygons for verification.`
  })
  @ExceptionResponse(UnauthorizedException, { description: "Authentication failed." })
  @ExceptionResponse(NotFoundException, { description: "Project not found or no fixable overlapping polygons." })
  @ExceptionResponse(BadRequestException, { description: "Invalid request data." })
  async createProjectPolygonClipping(@Param("siteUuid") siteUuid: string) {
    await this.policyService.authorize("readAll", SitePolygon);

    const fixablePolygons = await this.clippingService.getFixablePolygonsForProjectBySite(siteUuid);

    if (fixablePolygons.length === 0) {
      throw new NotFoundException(`No fixable overlapping polygons found for project via site ${siteUuid}`);
    }

    const originalGeometries = await this.clippingService.getOriginalGeometriesGeoJson(fixablePolygons);

    const clippedResults = await this.clippingService.clipPolygons(fixablePolygons);
    const clippedGeometries = this.clippingService.buildGeoJsonResponse(clippedResults);

    return {
      originalGeometries,
      clippedGeometries,
      summary: {
        totalPolygonsProcessed: fixablePolygons.length,
        polygonsClipped: clippedResults.length,
        message: `Successfully processed ${fixablePolygons.length} polygons, clipped ${clippedResults.length} polygons`
      }
    };
  }

  @Post("polygons")
  @ApiOperation({
    operationId: "createPolygonListClipping",
    summary: "Create polygon clipping for a custom list",
    description: `Clips a specific list of polygons for fixable overlaps (≤3.5% AND ≤0.118 hectares).
      Returns GeoJSON of original and clipped polygons for verification.
      Does NOT modify the database or create new versions yet.`
  })
  @ExceptionResponse(UnauthorizedException, { description: "Authentication failed." })
  @ExceptionResponse(NotFoundException, { description: "No fixable overlapping polygons found." })
  @ExceptionResponse(BadRequestException, { description: "Invalid request data." })
  async createPolygonListClipping(@Body() payload: PolygonListClippingRequestBody) {
    await this.policyService.authorize("readAll", SitePolygon);

    const polygonUuids = payload.data.attributes.polygonUuids;

    if (polygonUuids.length === 0) {
      throw new BadRequestException("No polygon UUIDs provided");
    }

    const fixablePolygons = await this.clippingService.filterFixablePolygonsFromList(polygonUuids);

    if (fixablePolygons.length === 0) {
      throw new NotFoundException("No fixable overlapping polygons found in the provided list");
    }

    const originalGeometries = await this.clippingService.getOriginalGeometriesGeoJson(fixablePolygons);

    const clippedResults = await this.clippingService.clipPolygons(fixablePolygons);
    const clippedGeometries = this.clippingService.buildGeoJsonResponse(clippedResults);

    return {
      originalGeometries,
      clippedGeometries,
      summary: {
        totalPolygonsProcessed: fixablePolygons.length,
        polygonsClipped: clippedResults.length,
        totalPolygonsRequested: polygonUuids.length,
        message: `Successfully processed ${fixablePolygons.length} fixable polygons from ${polygonUuids.length} requested, clipped ${clippedResults.length} polygons`
      }
    };
  }
}

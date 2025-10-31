import { Controller, Post, Body, Param, Logger, NotFoundException, BadRequestException } from "@nestjs/common";
import { ApiOperation, ApiTags, ApiResponse } from "@nestjs/swagger";
import { PolygonClippingService } from "./polygon-clipping.service";
import { ClipPolygonsRequestDto, ClipPolygonsResponseDto } from "./dto/clip-polygons.dto";
import { SitePolygon, Site, PolygonGeometry } from "@terramatch-microservices/database/entities";

@ApiTags("Polygon Clipping")
@Controller("research/v3/clip-polygons")
export class PolygonClippingController {
  private readonly logger = new Logger(PolygonClippingController.name);

  constructor(private readonly polygonClippingService: PolygonClippingService) {}

  /**
   * Test endpoint: Clip a single polygon and return GeoJSON
   * POST /research/v3/clip-polygons/polygon/:uuid
   */
  @Post("polygon/:uuid")
  @ApiOperation({
    operationId: "clipSinglePolygon",
    summary: "Test endpoint: Clip overlaps for a single polygon",
    description: `Clips overlapping areas from a single polygon and returns the modified GeoJSON.
      This is a test endpoint to verify the clipping logic works correctly.
      Only returns polygons that were actually modified.`
  })
  @ApiResponse({
    status: 200,
    description: "Returns clipped polygon GeoJSON",
    type: ClipPolygonsResponseDto
  })
  @ApiResponse({
    status: 400,
    description: "No overlapping errors found or polygon needs validation checks"
  })
  @ApiResponse({
    status: 404,
    description: "Polygon not found"
  })
  async clipSinglePolygon(@Param("uuid") uuid: string): Promise<ClipPolygonsResponseDto> {
    this.logger.log(`Clipping single polygon: ${uuid}`);

    // Verify polygon exists
    const polygonGeometry = await PolygonGeometry.findOne({ where: { uuid } });
    if (polygonGeometry === null) {
      throw new NotFoundException(`Polygon with UUID ${uuid} not found`);
    }

    // Get the site polygon to find related polygons in the same project
    const sitePolygon = await SitePolygon.findOne({
      where: { polygonUuid: uuid, isActive: true },
      include: [{ model: Site, as: "site", required: true, attributes: ["uuid", "projectId"] }]
    });

    if (sitePolygon === null || sitePolygon.site === null) {
      throw new NotFoundException(`Site polygon not found for UUID ${uuid}`);
    }

    // Get all polygons in the same project
    const projectPolygons = await SitePolygon.findAll({
      where: { isActive: true },
      include: [
        {
          model: Site,
          as: "site",
          required: true,
          where: { projectId: sitePolygon.site.projectId },
          attributes: ["projectId"]
        }
      ],
      attributes: ["polygonUuid"]
    });

    const allPolygonUuids = projectPolygons.map(sp => sp.polygonUuid).filter(pUuid => pUuid != null) as string[];

    if (allPolygonUuids.length === 0) {
      throw new BadRequestException("No polygons found in the project");
    }

    this.logger.log(`Found ${allPolygonUuids.length} polygons in the project`);

    // Get GeoJSON for all project polygons
    const geojson = await this.polygonClippingService.getPolygonsGeojson(allPolygonUuids);

    // Clip overlapping polygons
    const clippedGeojson = await this.polygonClippingService.clipPolygons(geojson);

    const modifiedUuids = clippedGeojson.features.map(f => f.properties?.poly_id).filter(Boolean) as string[];

    return {
      updated_polygons: clippedGeojson,
      clipped_count: clippedGeojson.features.length,
      total_processed: allPolygonUuids.length,
      modified_polygon_uuids: modifiedUuids
    };
  }

  /**
   * Test endpoint: Clip all overlapping polygons in a site
   * POST /research/v3/clip-polygons/site/:uuid
   */
  @Post("site/:siteUuid")
  @ApiOperation({
    operationId: "clipPolygonsBySite",
    summary: "Test endpoint: Clip overlaps for all polygons in a site",
    description: `Clips overlapping areas for all polygons within a site and returns modified GeoJSON.
      This is a test endpoint to verify the clipping logic works correctly.
      Only returns polygons that were actually modified.`
  })
  @ApiResponse({
    status: 200,
    description: "Returns clipped polygons GeoJSON",
    type: ClipPolygonsResponseDto
  })
  @ApiResponse({
    status: 404,
    description: "Site not found or no polygons in site"
  })
  async clipPolygonsBySite(@Param("siteUuid") siteUuid: string): Promise<ClipPolygonsResponseDto> {
    this.logger.log(`Clipping polygons for site: ${siteUuid}`);

    // Get site
    const site = await Site.findOne({ where: { uuid: siteUuid } });
    if (site === null) {
      throw new NotFoundException(`Site with UUID ${siteUuid} not found`);
    }

    // Get all active polygons for the site
    const sitePolygons = await SitePolygon.findAll({
      where: { siteUuid, isActive: true },
      attributes: ["polygonUuid"]
    });

    const polygonUuids = sitePolygons.map(sp => sp.polygonUuid).filter(pUuid => pUuid != null) as string[];

    if (polygonUuids.length === 0) {
      throw new NotFoundException(`No active polygons found for site ${siteUuid}`);
    }

    this.logger.log(`Found ${polygonUuids.length} polygons in site`);

    // Get GeoJSON for all site polygons
    const geojson = await this.polygonClippingService.getPolygonsGeojson(polygonUuids);

    // Clip overlapping polygons
    const clippedGeojson = await this.polygonClippingService.clipPolygons(geojson);

    const modifiedUuids = clippedGeojson.features.map(f => f.properties?.poly_id).filter(Boolean) as string[];

    return {
      updated_polygons: clippedGeojson,
      clipped_count: clippedGeojson.features.length,
      total_processed: polygonUuids.length,
      modified_polygon_uuids: modifiedUuids
    };
  }

  /**
   * Test endpoint: Clip specific polygons by UUIDs
   * POST /research/v3/clip-polygons/polygons
   */
  @Post("polygons")
  @ApiOperation({
    operationId: "clipPolygonsByUuids",
    summary: "Test endpoint: Clip overlaps for specific polygons",
    description: `Clips overlapping areas for a list of polygon UUIDs and returns modified GeoJSON.
      This is a test endpoint to verify the clipping logic works correctly.
      Only returns polygons that were actually modified.`
  })
  @ApiResponse({
    status: 200,
    description: "Returns clipped polygons GeoJSON",
    type: ClipPolygonsResponseDto
  })
  @ApiResponse({
    status: 400,
    description: "Invalid or missing UUIDs"
  })
  async clipPolygonsByUuids(@Body() request: ClipPolygonsRequestDto): Promise<ClipPolygonsResponseDto> {
    this.logger.log(`Clipping ${request.uuids.length} polygons`);

    if (request.uuids === undefined || request.uuids.length === 0) {
      throw new BadRequestException("Invalid or missing UUIDs");
    }

    // Verify all polygons exist
    const polygonGeometries = await PolygonGeometry.findAll({
      where: { uuid: request.uuids },
      attributes: ["uuid"]
    });

    if (polygonGeometries.length === 0) {
      throw new NotFoundException("No polygons found for the provided UUIDs");
    }

    if (polygonGeometries.length !== request.uuids.length) {
      const foundUuids = polygonGeometries.map(pg => pg.uuid);
      const missingUuids = request.uuids.filter(uuid => !foundUuids.includes(uuid));
      this.logger.warn(`Some polygons not found: ${missingUuids.join(", ")}`);
    }

    // Get GeoJSON for polygons
    const geojson = await this.polygonClippingService.getPolygonsGeojson(request.uuids);

    // Clip overlapping polygons
    const clippedGeojson = await this.polygonClippingService.clipPolygons(geojson);

    const modifiedUuids = clippedGeojson.features.map(f => f.properties?.poly_id).filter(Boolean) as string[];

    return {
      updated_polygons: clippedGeojson,
      clipped_count: clippedGeojson.features.length,
      total_processed: request.uuids.length,
      modified_polygon_uuids: modifiedUuids
    };
  }

  /**
   * Test endpoint: Clip all polygons in a project by site UUID
   * POST /research/v3/clip-polygons/project/by-site/:uuid
   */
  @Post("project/by-site/:siteUuid")
  @ApiOperation({
    operationId: "clipProjectPolygonsBySite",
    summary: "Test endpoint: Clip overlaps for all polygons in a project (via site UUID)",
    description: `Clips overlapping areas for all polygons in a project identified by a site UUID.
      This is a test endpoint to verify the clipping logic works correctly.
      Only returns polygons that were actually modified.`
  })
  @ApiResponse({
    status: 200,
    description: "Returns clipped polygons GeoJSON",
    type: ClipPolygonsResponseDto
  })
  @ApiResponse({
    status: 404,
    description: "Site or project not found"
  })
  async clipProjectPolygonsBySite(@Param("siteUuid") siteUuid: string): Promise<ClipPolygonsResponseDto> {
    this.logger.log(`Clipping project polygons via site: ${siteUuid}`);

    // Get site
    const site = await Site.findOne({ where: { uuid: siteUuid } });
    if (site === null) {
      throw new NotFoundException(`Site with UUID ${siteUuid} not found`);
    }

    if (site.projectId === null) {
      throw new NotFoundException(`Project not found for site ${siteUuid}`);
    }

    // Get all polygons in the project
    const projectPolygons = await SitePolygon.findAll({
      where: { isActive: true },
      include: [
        {
          model: Site,
          as: "site",
          required: true,
          where: { projectId: site.projectId },
          attributes: ["projectId"]
        }
      ],
      attributes: ["polygonUuid"]
    });

    const polygonUuids = projectPolygons.map(sp => sp.polygonUuid).filter(pUuid => pUuid != null) as string[];

    if (polygonUuids.length === 0) {
      throw new NotFoundException(`No polygons found in project ${site.projectId}`);
    }

    this.logger.log(`Found ${polygonUuids.length} polygons in project`);

    // Get GeoJSON for all project polygons
    const geojson = await this.polygonClippingService.getPolygonsGeojson(polygonUuids);

    // Clip overlapping polygons
    const clippedGeojson = await this.polygonClippingService.clipPolygons(geojson);

    const modifiedUuids = clippedGeojson.features.map(f => f.properties?.poly_id).filter(Boolean) as string[];

    return {
      updated_polygons: clippedGeojson,
      clipped_count: clippedGeojson.features.length,
      total_processed: polygonUuids.length,
      modified_polygon_uuids: modifiedUuids
    };
  }
}

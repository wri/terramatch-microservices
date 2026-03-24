import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  Logger,
  NotFoundException,
  Param,
  Put,
  UnauthorizedException,
  UploadedFile,
  UseInterceptors
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiOperation } from "@nestjs/swagger";
import { buildDeletedResponse, buildJsonApi, getDtoType } from "@terramatch-microservices/common/util";
import { ExceptionResponse, JsonApiResponse } from "@terramatch-microservices/common/decorators";
import { JsonApiDeletedResponse } from "@terramatch-microservices/common/decorators/json-api-response.decorator";
import { PolicyService } from "@terramatch-microservices/common";
import { AnrPlotGeometry } from "@terramatch-microservices/database/entities";
import { GeometryFileProcessingService } from "./geometry-file-processing.service";
import { AnrPlotGeometryService } from "./anr-plot-geometry.service";
import { AnrPlotGeometryDto } from "./dto/anr-plot-geometry.dto";
import { GeoJsonExportDto } from "../geojson-export/dto/geojson-export.dto";
import { FeatureCollection } from "geojson";
import "multer";

@Controller("research/v3/sitePolygons/:sitePolygonUuid/plotGeometry")
export class AnrPlotGeometryController {
  private readonly logger = new Logger(AnrPlotGeometryController.name);

  constructor(
    private readonly anrPlotGeometryService: AnrPlotGeometryService,
    private readonly geometryFileProcessingService: GeometryFileProcessingService,
    private readonly policyService: PolicyService
  ) {}

  @Get()
  @ApiOperation({
    operationId: "getAnrPlotGeometry",
    summary: "Get ANR monitoring plot grid for a site polygon",
    description: `Returns the active GeoJSON FeatureCollection of ANR monitoring plots
      uploaded for the specified site polygon.`
  })
  @JsonApiResponse(AnrPlotGeometryDto)
  @ExceptionResponse(UnauthorizedException, { description: "Authentication failed." })
  @ExceptionResponse(NotFoundException, { description: "No plot geometry found for this polygon." })
  @ExceptionResponse(BadRequestException, { description: "Site polygon is not eligible for ANR monitoring plots." })
  async getPlotGeometry(@Param("sitePolygonUuid") sitePolygonUuid: string) {
    await this.anrPlotGeometryService.requireSitePolygonEligibleForAnrPlots(sitePolygonUuid);

    const plot = await this.anrPlotGeometryService.getPlotOrThrow(sitePolygonUuid);

    await this.policyService.authorize("read", plot);

    const document = buildJsonApi(AnrPlotGeometryDto);
    return document.addData(sitePolygonUuid, new AnrPlotGeometryDto(plot));
  }

  @Get("geojson")
  @ApiOperation({
    operationId: "getAnrPlotGeometryGeoJson",
    summary: "Download ANR monitoring plot grid as GeoJSON",
    description: `Returns the active ANR monitoring plot grid as a GeoJSON FeatureCollection
      for the specified site polygon. Reuses the standard GeoJsonExportDto shape,
      consistent with other geometry export endpoints.`
  })
  @JsonApiResponse(GeoJsonExportDto)
  @ExceptionResponse(UnauthorizedException, { description: "Authentication failed." })
  @ExceptionResponse(NotFoundException, { description: "No plot geometry found for this polygon." })
  @ExceptionResponse(BadRequestException, { description: "Site polygon is not eligible for ANR monitoring plots." })
  async getPlotGeometryGeoJson(@Param("sitePolygonUuid") sitePolygonUuid: string) {
    await this.policyService.authorize("read", AnrPlotGeometry);

    await this.anrPlotGeometryService.requireSitePolygonEligibleForAnrPlots(sitePolygonUuid);

    const plot = await this.anrPlotGeometryService.getPlotOrThrow(sitePolygonUuid);

    const featureCollection = plot.geojson as unknown as FeatureCollection;
    const document = buildJsonApi(GeoJsonExportDto);
    return document.addData(sitePolygonUuid, new GeoJsonExportDto(featureCollection));
  }

  @Put()
  @ApiOperation({
    operationId: "upsertAnrPlotGeometry",
    summary: "Upload or replace ANR monitoring plot grid for a site polygon",
    description: `Uploads a GeoJSON FeatureCollection as the ANR monitoring plot grid for
      the specified site polygon. If a plot already exists it is soft-deleted and replaced
      atomically. Supported formats: GeoJSON (.geojson), KML (.kml), Shapefile (.zip).
      Admin only (polygons-manage permission required).`
  })
  @UseInterceptors(FileInterceptor("file"))
  @JsonApiResponse(AnrPlotGeometryDto)
  @ExceptionResponse(UnauthorizedException, { description: "Authentication failed or insufficient permissions." })
  @ExceptionResponse(NotFoundException, { description: "Site polygon not found." })
  @ExceptionResponse(BadRequestException, {
    description: "Invalid file format, no features found, or site polygon not eligible for ANR monitoring plots."
  })
  async upsertPlotGeometry(
    @Param("sitePolygonUuid") sitePolygonUuid: string,
    @UploadedFile() file: Express.Multer.File
  ) {
    await this.policyService.authorize("create", AnrPlotGeometry);

    const userId = this.policyService.userId;
    if (userId == null) {
      throw new UnauthorizedException("User must be authenticated");
    }

    await this.anrPlotGeometryService.requireSitePolygonEligibleForAnrPlots(sitePolygonUuid);

    const featureCollection = await this.geometryFileProcessingService.parseGeometryFile(file);

    const plot = await this.anrPlotGeometryService.upsertPlot(sitePolygonUuid, featureCollection, userId);

    const document = buildJsonApi(AnrPlotGeometryDto);
    return document.addData(sitePolygonUuid, new AnrPlotGeometryDto(plot));
  }

  @Delete()
  @ApiOperation({
    operationId: "deleteAnrPlotGeometry",
    summary: "Delete ANR monitoring plot grid for a site polygon",
    description: `Soft-deletes the active ANR plot grid for the specified site polygon.
      The record is retained in history (deletedAt is set). Admin only.`
  })
  @JsonApiDeletedResponse([getDtoType(AnrPlotGeometryDto)], {
    description: "ANR plot geometry was soft-deleted"
  })
  @ExceptionResponse(UnauthorizedException, { description: "Authentication failed or insufficient permissions." })
  @ExceptionResponse(NotFoundException, { description: "No plot geometry found for this polygon." })
  @ExceptionResponse(BadRequestException, { description: "Site polygon is not eligible for ANR monitoring plots." })
  async deletePlotGeometry(@Param("sitePolygonUuid") sitePolygonUuid: string) {
    await this.policyService.authorize("delete", AnrPlotGeometry);

    await this.anrPlotGeometryService.requireSitePolygonEligibleForAnrPlots(sitePolygonUuid);

    await this.anrPlotGeometryService.getPlotOrThrow(sitePolygonUuid);

    await this.anrPlotGeometryService.deletePlot(sitePolygonUuid);

    return buildDeletedResponse(getDtoType(AnrPlotGeometryDto), sitePolygonUuid);
  }
}

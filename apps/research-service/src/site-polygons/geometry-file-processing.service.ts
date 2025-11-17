import { Injectable, BadRequestException, Logger } from "@nestjs/common";
import { FeatureCollection } from "geojson";
import { SitePolygonCreationService } from "./site-polygon-creation.service";
import { CreateSitePolygonBatchRequestDto, CreateSitePolygonRequestDto } from "./dto/create-site-polygon-request.dto";
import "multer";

/**
 * Service for processing geometry files (KML, Shapefile, GeoJSON) and converting them to site polygons.
 */
@Injectable()
export class GeometryFileProcessingService {
  private readonly logger = new Logger(GeometryFileProcessingService.name);

  constructor(private readonly sitePolygonCreationService: SitePolygonCreationService) {}

  /**
   * Processes a geometry file and creates site polygons from it.
   *
   * Files are processed in memory only - NOT stored to S3 (they are temporary).
   *
   * Supported formats: KML (.kml), Shapefile (.zip with .shp/.shx/.dbf), GeoJSON (.geojson)
   *
   * @param file The uploaded file from multer
   * @param userId The user ID creating the polygons
   * @param source The source of the polygons (e.g., "terramatch")
   * @param userFullName The full name of the user
   * @returns The created site polygons and validation results
   */
  async processGeometryFile(
    file: Express.Multer.File,
    userId: number,
    source: string,
    userFullName: string | null
  ): Promise<{
    data: Awaited<ReturnType<SitePolygonCreationService["createSitePolygons"]>>["data"];
    included: Awaited<ReturnType<SitePolygonCreationService["createSitePolygons"]>>["included"];
  }> {
    if (file == null) {
      throw new BadRequestException("No file provided");
    }

    this.logger.log(`🔵 Starting geometry file processing`);
    this.logger.log(`📁 File: ${file.originalname}`);
    this.logger.log(`📊 Size: ${(file.size / 1024).toFixed(2)} KB`);
    this.logger.log(`📋 MIME type: ${file.mimetype}`);
    this.logger.log(`👤 User: ${userId} (${userFullName ?? "no name"})`);

    const geojson = await this.parseGeometryFile(file);

    if (geojson.features == null || geojson.features.length === 0) {
      throw new BadRequestException("No features found in the uploaded file");
    }

    this.logger.log(`✅ Successfully parsed ${geojson.features.length} features from ${file.originalname}`);

    const validFeatures = geojson.features.filter(feature => feature.properties != null);

    if (validFeatures.length === 0) {
      throw new BadRequestException("No features with valid properties found in the file");
    }

    if (validFeatures.length < geojson.features.length) {
      this.logger.warn(
        `⚠️  Filtered out ${geojson.features.length - validFeatures.length} features with null properties`
      );
    }

    const batchRequest: CreateSitePolygonBatchRequestDto = {
      geometries: [{ ...geojson, features: validFeatures } as CreateSitePolygonRequestDto]
    };

    this.logger.log(`🔄 Creating site polygons in database...`);

    const result = await this.sitePolygonCreationService.createSitePolygons(batchRequest, userId, source, userFullName);

    this.logger.log(`✅ Successfully created ${result.data.length} site polygons`);
    this.logger.log(`ℹ️  Note: Original file was NOT stored (processed in memory only)`);

    return result;
  }

  /**
   * Parses a geometry file based on its type and returns GeoJSON.
   *
   * @param file The uploaded file
   * @returns A GeoJSON FeatureCollection
   */
  private async parseGeometryFile(file: Express.Multer.File): Promise<FeatureCollection> {
    const fileName = file.originalname.toLowerCase();
    const mimeType = file.mimetype.toLowerCase();

    if (fileName.endsWith(".geojson") || mimeType === "application/geo+json" || mimeType === "application/json") {
      return this.parseGeoJSON(file);
    }

    if (
      fileName.endsWith(".kml") ||
      mimeType === "application/vnd.google-earth.kml+xml" ||
      mimeType === "application/xml"
    ) {
      return this.parseKML(file);
    }

    if (fileName.endsWith(".zip") || fileName.endsWith(".shp") || mimeType === "application/zip") {
      return this.parseShapefile(file);
    }

    throw new BadRequestException(
      `Unsupported file format. Supported formats: KML (.kml), Shapefile (.zip with .shp/.shx/.dbf), GeoJSON (.geojson)`
    );
  }

  /**
   * Parses a GeoJSON file.
   */
  private async parseGeoJSON(file: Express.Multer.File): Promise<FeatureCollection> {
    try {
      const content = file.buffer.toString("utf-8");
      const geojson = JSON.parse(content) as FeatureCollection;

      if (geojson.type !== "FeatureCollection") {
        throw new BadRequestException("GeoJSON file must be a FeatureCollection");
      }

      return geojson;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Failed to parse GeoJSON file: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private async parseKML(_: Express.Multer.File): Promise<FeatureCollection> {
    throw new BadRequestException(
      "KML parsing not yet implemented. Please install @mapbox/togeojson and @xmldom/xmldom packages."
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private async parseShapefile(_: Express.Multer.File): Promise<FeatureCollection> {
    throw new BadRequestException("Shapefile parsing not yet implemented. Please install shpjs package.");
  }
}

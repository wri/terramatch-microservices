import { Injectable, BadRequestException } from "@nestjs/common";
import { FeatureCollection, Feature } from "geojson";
import * as shapefile from "shapefile";
import AdmZip = require("adm-zip");
import * as toGeoJSON from "@tmcw/togeojson";
import { DOMParser } from "@xmldom/xmldom";
import "multer";

@Injectable()
export class GeometryFileProcessingService {
  async parseGeometryFile(file: Express.Multer.File): Promise<FeatureCollection> {
    if (file == null) {
      throw new BadRequestException("No file provided");
    }

    const geojson = await this.parseFile(file);

    if (geojson.features == null || geojson.features.length === 0) {
      throw new BadRequestException("No features found in the uploaded file");
    }

    return geojson;
  }

  private async parseFile(file: Express.Multer.File): Promise<FeatureCollection> {
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

  private async parseKML(file: Express.Multer.File): Promise<FeatureCollection> {
    try {
      const kmlString = file.buffer.toString("utf-8");
      const kmlDoc = new DOMParser().parseFromString(kmlString, "text/xml");
      const geojson = toGeoJSON.kml(kmlDoc) as FeatureCollection;

      if (geojson.type !== "FeatureCollection") {
        throw new BadRequestException("KML file must contain valid features");
      }

      return geojson;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Failed to parse KML file: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private async parseShapefile(file: Express.Multer.File): Promise<FeatureCollection> {
    try {
      const zip = new AdmZip(file.buffer);
      const zipEntries = zip.getEntries();

      const shpEntry = zipEntries.find(entry => entry.entryName.toLowerCase().endsWith(".shp"));
      const dbfEntry = zipEntries.find(entry => entry.entryName.toLowerCase().endsWith(".dbf"));

      if (shpEntry == null) {
        throw new BadRequestException("ZIP file must contain a .shp file");
      }

      if (dbfEntry == null) {
        throw new BadRequestException("ZIP file must contain a .dbf file (required for attributes)");
      }

      const shpBuffer = shpEntry.getData();
      const dbfBuffer = dbfEntry.getData();

      const source = await shapefile.open(shpBuffer, dbfBuffer);
      const features: Feature[] = [];

      let result = await source.read();
      while (result.done === false) {
        if (result.value != null) {
          features.push(result.value);
        }
        result = await source.read();
      }

      if (features.length === 0) {
        throw new BadRequestException("Shapefile contains no features");
      }

      return {
        type: "FeatureCollection",
        features
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      const errorMessage = error instanceof Error ? error.message : String(error);

      if (errorMessage.toLowerCase().includes("invalid") || errorMessage.toLowerCase().includes("shp")) {
        throw new BadRequestException(
          `Invalid Shapefile format. Please ensure the ZIP contains .shp, .shx, and .dbf files. Error: ${errorMessage}`
        );
      }

      throw new BadRequestException(`Failed to parse Shapefile: ${errorMessage}`);
    }
  }
}

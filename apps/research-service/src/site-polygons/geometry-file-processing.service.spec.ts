import { Test, TestingModule } from "@nestjs/testing";
import { BadRequestException } from "@nestjs/common";
import { GeometryFileProcessingService } from "./geometry-file-processing.service";
import * as fs from "fs";
import * as path from "path";

jest.mock("@tmcw/togeojson", () => {
  const actual = jest.requireActual("@tmcw/togeojson");
  return {
    ...actual,
    kml: jest.fn()
  };
});

import * as toGeoJSON from "@tmcw/togeojson";

describe("GeometryFileProcessingService", () => {
  let service: GeometryFileProcessingService;

  beforeEach(async () => {
    const actualToGeoJSON = jest.requireActual("@tmcw/togeojson");
    (toGeoJSON.kml as jest.Mock).mockImplementation(actualToGeoJSON.kml);

    const module: TestingModule = await Test.createTestingModule({
      providers: [GeometryFileProcessingService]
    }).compile();

    service = module.get<GeometryFileProcessingService>(GeometryFileProcessingService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("parseGeometryFile", () => {
    it("should throw BadRequestException when no file provided", async () => {
      await expect(service.parseGeometryFile(null as unknown as Express.Multer.File)).rejects.toThrow(
        BadRequestException
      );
      await expect(service.parseGeometryFile(null as unknown as Express.Multer.File)).rejects.toThrow(
        "No file provided"
      );
    });

    it("should throw BadRequestException when file has no features", async () => {
      const emptyGeoJSON = { type: "FeatureCollection", features: [] };
      const file = {
        originalname: "empty.geojson",
        mimetype: "application/geo+json",
        buffer: Buffer.from(JSON.stringify(emptyGeoJSON))
      } as Express.Multer.File;

      await expect(service.parseGeometryFile(file)).rejects.toThrow(BadRequestException);
      await expect(service.parseGeometryFile(file)).rejects.toThrow("No features found in the uploaded file");
    });

    it("should throw BadRequestException for unsupported file format", async () => {
      const file = {
        originalname: "test.txt",
        mimetype: "text/plain",
        buffer: Buffer.from("plain text")
      } as Express.Multer.File;

      await expect(service.parseGeometryFile(file)).rejects.toThrow(BadRequestException);
      await expect(service.parseGeometryFile(file)).rejects.toThrow("Unsupported file format");
    });
  });

  describe("GeoJSON parsing", () => {
    it("should parse valid GeoJSON FeatureCollection", async () => {
      const geojson = {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            geometry: {
              type: "Polygon",
              coordinates: [
                [
                  [0, 0],
                  [1, 0],
                  [1, 1],
                  [0, 1],
                  [0, 0]
                ]
              ]
            },
            properties: { name: "Test Polygon" }
          }
        ]
      };
      const file = {
        originalname: "test.geojson",
        mimetype: "application/geo+json",
        buffer: Buffer.from(JSON.stringify(geojson))
      } as Express.Multer.File;

      const result = await service.parseGeometryFile(file);

      expect(result.type).toBe("FeatureCollection");
      expect(result.features).toHaveLength(1);
      expect(result.features[0].geometry.type).toBe("Polygon");
      expect(result.features[0].properties?.name).toBe("Test Polygon");
    });

    it("should parse GeoJSON with application/json mimetype", async () => {
      const geojson = {
        type: "FeatureCollection",
        features: [{ type: "Feature", geometry: { type: "Point", coordinates: [0, 0] }, properties: {} }]
      };
      const file = {
        originalname: "test.geojson",
        mimetype: "application/json",
        buffer: Buffer.from(JSON.stringify(geojson))
      } as Express.Multer.File;

      const result = await service.parseGeometryFile(file);

      expect(result.type).toBe("FeatureCollection");
      expect(result.features).toHaveLength(1);
    });

    it("should throw BadRequestException for invalid GeoJSON", async () => {
      const file = {
        originalname: "invalid.geojson",
        mimetype: "application/geo+json",
        buffer: Buffer.from("not valid json")
      } as Express.Multer.File;

      await expect(service.parseGeometryFile(file)).rejects.toThrow(BadRequestException);
      await expect(service.parseGeometryFile(file)).rejects.toThrow("Failed to parse GeoJSON file");
    });

    it("should throw BadRequestException when GeoJSON is not a FeatureCollection", async () => {
      const feature = {
        type: "Feature",
        geometry: { type: "Point", coordinates: [0, 0] },
        properties: {}
      };
      const file = {
        originalname: "feature.geojson",
        mimetype: "application/geo+json",
        buffer: Buffer.from(JSON.stringify(feature))
      } as Express.Multer.File;

      await expect(service.parseGeometryFile(file)).rejects.toThrow(BadRequestException);
      await expect(service.parseGeometryFile(file)).rejects.toThrow("GeoJSON file must be a FeatureCollection");
    });
  });

  describe("KML parsing", () => {
    it("should parse valid KML with Placemark", async () => {
      const kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <Placemark>
      <name>Test Point</name>
      <Point>
        <coordinates>-122.0822035425683,37.42228990140251,0</coordinates>
      </Point>
    </Placemark>
  </Document>
</kml>`;
      const file = {
        originalname: "test.kml",
        mimetype: "application/vnd.google-earth.kml+xml",
        buffer: Buffer.from(kml)
      } as Express.Multer.File;

      const result = await service.parseGeometryFile(file);

      expect(result.type).toBe("FeatureCollection");
      expect(result.features.length).toBeGreaterThan(0);
    });

    it("should parse KML with .kml extension", async () => {
      const kml = `<?xml version="1.0"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Placemark>
    <Polygon>
      <outerBoundaryIs>
        <LinearRing>
          <coordinates>0,0,0 1,0,0 1,1,0 0,1,0 0,0,0</coordinates>
        </LinearRing>
      </outerBoundaryIs>
    </Polygon>
  </Placemark>
</kml>`;
      const file = {
        originalname: "test.kml",
        mimetype: "application/xml",
        buffer: Buffer.from(kml)
      } as Express.Multer.File;

      const result = await service.parseGeometryFile(file);

      expect(result.type).toBe("FeatureCollection");
      expect(result.features.length).toBeGreaterThan(0);
    });

    it("should throw BadRequestException for empty KML (no features)", async () => {
      const emptyKml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>Empty Document</name>
  </Document>
</kml>`;
      const file = {
        originalname: "empty.kml",
        mimetype: "application/vnd.google-earth.kml+xml",
        buffer: Buffer.from(emptyKml)
      } as Express.Multer.File;

      await expect(service.parseGeometryFile(file)).rejects.toThrow(BadRequestException);
      await expect(service.parseGeometryFile(file)).rejects.toThrow("No features found in the uploaded file");
    });

    it("should throw BadRequestException for KML that parses but has no features", async () => {
      const invalidBinary = Buffer.from([0xff, 0xfe, 0xfd, 0xfc]);
      const file = {
        originalname: "invalid.kml",
        mimetype: "application/vnd.google-earth.kml+xml",
        buffer: invalidBinary
      } as Express.Multer.File;

      await expect(service.parseGeometryFile(file)).rejects.toThrow(BadRequestException);
      await expect(service.parseGeometryFile(file)).rejects.toThrow("No features found in the uploaded file");
    });

    it("should throw BadRequestException when KML parsing throws an error", async () => {
      const kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <Placemark>
      <Point>
        <coordinates>-122.0822035425683,37.42228990140251,0</coordinates>
      </Point>
    </Placemark>
  </Document>
</kml>`;
      const file = {
        originalname: "test.kml",
        mimetype: "application/vnd.google-earth.kml+xml",
        buffer: Buffer.from(kml)
      } as Express.Multer.File;

      const parseError = new Error("XML parsing failed");
      (toGeoJSON.kml as jest.Mock).mockImplementationOnce(() => {
        throw parseError;
      });

      await expect(service.parseGeometryFile(file)).rejects.toThrow(
        new BadRequestException("Failed to parse KML file: XML parsing failed")
      );
    });
  });

  describe("Shapefile parsing", () => {
    it("should parse valid Shapefile ZIP", async () => {
      const zipPath = path.join(__dirname, "test-shapefile.zip");
      const zipBuffer = fs.readFileSync(zipPath);

      const file = {
        originalname: "test.zip",
        mimetype: "application/zip",
        buffer: zipBuffer
      } as Express.Multer.File;

      const result = await service.parseGeometryFile(file);

      expect(result.type).toBe("FeatureCollection");
      expect(result.features.length).toBeGreaterThan(0);
      expect(result.features[0].type).toBe("Feature");
      expect(result.features[0].geometry).toBeDefined();
    });

    it("should parse Shapefile with .zip extension", async () => {
      const zipPath = path.join(__dirname, "test-shapefile.zip");
      const zipBuffer = fs.readFileSync(zipPath);

      const file = {
        originalname: "polygons.zip",
        mimetype: "application/x-zip-compressed",
        buffer: zipBuffer
      } as Express.Multer.File;

      const result = await service.parseGeometryFile(file);

      expect(result.type).toBe("FeatureCollection");
      expect(result.features.length).toBeGreaterThan(0);
    });

    it("should throw BadRequestException when ZIP missing .shp file", async () => {
      const AdmZip = require("adm-zip");
      const zip = new AdmZip();
      zip.addFile("test.dbf", Buffer.from("dummy"));
      const zipBuffer = zip.toBuffer();

      const file = {
        originalname: "missing-shp.zip",
        mimetype: "application/zip",
        buffer: zipBuffer
      } as Express.Multer.File;

      await expect(service.parseGeometryFile(file)).rejects.toThrow(BadRequestException);
      await expect(service.parseGeometryFile(file)).rejects.toThrow("ZIP file must contain a .shp file");
    });

    it("should throw BadRequestException when ZIP missing .dbf file", async () => {
      const AdmZip = require("adm-zip");
      const zip = new AdmZip();
      zip.addFile("test.shp", Buffer.from("dummy"));
      const zipBuffer = zip.toBuffer();

      const file = {
        originalname: "missing-dbf.zip",
        mimetype: "application/zip",
        buffer: zipBuffer
      } as Express.Multer.File;

      await expect(service.parseGeometryFile(file)).rejects.toThrow(BadRequestException);
      await expect(service.parseGeometryFile(file)).rejects.toThrow("ZIP file must contain a .dbf file");
    });

    it("should throw BadRequestException for invalid Shapefile binary format", async () => {
      const AdmZip = require("adm-zip");
      const zip = new AdmZip();
      zip.addFile("test.shp", Buffer.from("invalid shapefile binary data"));
      zip.addFile("test.dbf", Buffer.from("invalid dbf binary data"));
      const zipBuffer = zip.toBuffer();

      const file = {
        originalname: "invalid-binary.zip",
        mimetype: "application/zip",
        buffer: zipBuffer
      } as Express.Multer.File;

      await expect(service.parseGeometryFile(file)).rejects.toThrow(BadRequestException);
      await expect(service.parseGeometryFile(file)).rejects.toThrow("Failed to parse Shapefile");
    });

    it("should throw BadRequestException for incomplete Shapefile data", async () => {
      const zipPath = path.join(__dirname, "incomplete-shapefile.zip");
      const zipBuffer = fs.readFileSync(zipPath);

      const file = {
        originalname: "incomplete.zip",
        mimetype: "application/zip",
        buffer: zipBuffer
      } as Express.Multer.File;

      await expect(service.parseGeometryFile(file)).rejects.toThrow(BadRequestException);
    });
  });
});

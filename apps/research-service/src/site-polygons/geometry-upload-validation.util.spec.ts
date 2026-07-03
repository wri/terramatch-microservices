import { BadRequestException } from "@nestjs/common";
import type { FeatureCollection } from "geojson";

import { LINEAR_RING_ERROR_MESSAGE } from "../validations/utils/linear-ring.util";
import {
  assertGeometryUploadFileSize,
  assertShapefileProjection,
  GEOMETRY_UPLOAD_ERROR_MESSAGES,
  GEOMETRY_UPLOAD_MAX_FILE_SIZE_BYTES,
  validateParsedGeometryCollection
} from "./geometry-upload-validation.util";

const validPolygonFeatureCollection = (): FeatureCollection => ({
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: {},
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [0, 0],
            [0, 1],
            [1, 1],
            [1, 0],
            [0, 0]
          ]
        ]
      }
    }
  ]
});

describe("geometry-upload-validation.util", () => {
  describe("assertGeometryUploadFileSize", () => {
    it("should reject files larger than 50MB", () => {
      const file = {
        size: GEOMETRY_UPLOAD_MAX_FILE_SIZE_BYTES + 1
      } as Express.Multer.File;

      expect(() => assertGeometryUploadFileSize(file)).toThrow(BadRequestException);
      expect(() => assertGeometryUploadFileSize(file)).toThrow(GEOMETRY_UPLOAD_ERROR_MESSAGES.FILE_SIZE_EXCEEDED);
    });

    it("should allow files at or below 50MB", () => {
      const file = {
        size: GEOMETRY_UPLOAD_MAX_FILE_SIZE_BYTES
      } as Express.Multer.File;

      expect(() => assertGeometryUploadFileSize(file)).not.toThrow();
    });
  });

  describe("assertShapefileProjection", () => {
    it("should allow missing .prj content", () => {
      expect(() => assertShapefileProjection(null)).not.toThrow();
      expect(() => assertShapefileProjection("")).not.toThrow();
    });

    it("should allow WGS-84 projection definitions", () => {
      expect(() => assertShapefileProjection('GEOGCS["WGS 84",DATUM["WGS_1984"...')).not.toThrow();
      expect(() => assertShapefileProjection('AUTHORITY["EPSG","4326"]')).not.toThrow();
    });

    it("should reject unsupported projections", () => {
      expect(() => assertShapefileProjection('PROJCS["WGS 84 / UTM zone 35N",GEOGCS["WGS 84"...')).toThrow(
        BadRequestException
      );
      expect(() => assertShapefileProjection('AUTHORITY["EPSG","32635"]')).toThrow(
        GEOMETRY_UPLOAD_ERROR_MESSAGES.PROJECTION
      );
    });
  });

  describe("validateParsedGeometryCollection", () => {
    it("should reject mixed point and polygon features", () => {
      const geojson: FeatureCollection = {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            properties: {},
            geometry: { type: "Point", coordinates: [0, 0] }
          },
          {
            type: "Feature",
            properties: {},
            geometry: {
              type: "Polygon",
              coordinates: [
                [
                  [0, 0],
                  [0, 1],
                  [1, 1],
                  [1, 0],
                  [0, 0]
                ]
              ]
            }
          }
        ]
      };

      expect(() => validateParsedGeometryCollection(geojson)).toThrow(
        GEOMETRY_UPLOAD_ERROR_MESSAGES.MIXED_GEOMETRY_TYPES
      );
    });

    it("should allow KML-style coordinates with zero elevation", () => {
      const geojson: FeatureCollection = {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            properties: {},
            geometry: {
              type: "Polygon",
              coordinates: [
                [
                  [0, 0, 0],
                  [0, 1, 0],
                  [1, 1, 0],
                  [1, 0, 0],
                  [0, 0, 0]
                ]
              ]
            }
          }
        ]
      };

      expect(() => validateParsedGeometryCollection(geojson)).not.toThrow();
    });

    it("should reject coordinates with non-zero elevation", () => {
      const geojson: FeatureCollection = {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            properties: {},
            geometry: {
              type: "Polygon",
              coordinates: [
                [
                  [0, 0, 10],
                  [0, 1, 10],
                  [1, 1, 10],
                  [1, 0, 10],
                  [0, 0, 10]
                ]
              ]
            }
          }
        ]
      };

      expect(() => validateParsedGeometryCollection(geojson)).toThrow(GEOMETRY_UPLOAD_ERROR_MESSAGES.COORDINATE_3D);
    });

    it("should reject coordinates outside WGS-84 bounds", () => {
      const geojson: FeatureCollection = {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            properties: {},
            geometry: {
              type: "Polygon",
              coordinates: [
                [
                  [500000, 6000000],
                  [501000, 6000000],
                  [501000, 6001000],
                  [500000, 6001000],
                  [500000, 6000000]
                ]
              ]
            }
          }
        ]
      };

      expect(() => validateParsedGeometryCollection(geojson)).toThrow(GEOMETRY_UPLOAD_ERROR_MESSAGES.PROJECTION);
    });

    it("should reject invalid linear rings", () => {
      const geojson: FeatureCollection = {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            properties: {},
            geometry: {
              type: "Polygon",
              coordinates: [
                [
                  [0, 0],
                  [0, 1],
                  [1, 1],
                  [1, 0]
                ]
              ]
            }
          }
        ]
      };

      expect(() => validateParsedGeometryCollection(geojson)).toThrow(LINEAR_RING_ERROR_MESSAGE);
    });

    it("should accept valid polygon uploads", () => {
      expect(() => validateParsedGeometryCollection(validPolygonFeatureCollection())).not.toThrow();
    });
  });
});

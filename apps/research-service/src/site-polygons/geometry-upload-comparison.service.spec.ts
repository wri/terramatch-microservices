import { Test, TestingModule } from "@nestjs/testing";
import { GeometryUploadComparisonService } from "./geometry-upload-comparison.service";
import { SitePolygon } from "@terramatch-microservices/database/entities";
import { FeatureCollection } from "geojson";
import { Op } from "sequelize";

describe("GeometryUploadComparisonService", () => {
  let service: GeometryUploadComparisonService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [GeometryUploadComparisonService]
    }).compile();

    service = module.get<GeometryUploadComparisonService>(GeometryUploadComparisonService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("compareUploadedFeaturesWithExisting", () => {
    it("should return empty result for empty GeoJSON", async () => {
      const geojson: FeatureCollection = {
        type: "FeatureCollection",
        features: []
      };

      jest.spyOn(SitePolygon, "findAll").mockResolvedValue([]);

      const result = await service.compareUploadedFeaturesWithExisting(geojson, "site-uuid");

      expect(result).toEqual({
        existingUuids: [],
        totalFeatures: 0,
        featuresForVersioning: 0,
        featuresForCreation: 0
      });
      expect(SitePolygon.findAll).not.toHaveBeenCalled();
    });

    it("should handle features without UUIDs", async () => {
      const geojson: FeatureCollection = {
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
            properties: {}
          },
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
            properties: null
          },
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
            properties: { uuid: "" }
          }
        ]
      };

      jest.spyOn(SitePolygon, "findAll").mockResolvedValue([]);

      const result = await service.compareUploadedFeaturesWithExisting(geojson, "site-uuid");

      expect(result).toEqual({
        existingUuids: [],
        totalFeatures: 3,
        featuresForVersioning: 0,
        featuresForCreation: 3
      });
      expect(SitePolygon.findAll).not.toHaveBeenCalled();
    });

    it("should identify all features as new when no UUIDs exist in database", async () => {
      const geojson: FeatureCollection = {
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
            properties: { uuid: "uuid-1" }
          },
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
            properties: { uuid: "uuid-2" }
          }
        ]
      };

      jest.spyOn(SitePolygon, "findAll").mockResolvedValue([]);

      const result = await service.compareUploadedFeaturesWithExisting(geojson, "site-uuid");

      expect(result).toEqual({
        existingUuids: [],
        totalFeatures: 2,
        featuresForVersioning: 0,
        featuresForCreation: 2
      });
      expect(SitePolygon.findAll).toHaveBeenCalledWith({
        where: {
          uuid: { [Op.in]: ["uuid-1", "uuid-2"] },
          siteUuid: "site-uuid",
          isActive: true
        },
        attributes: ["uuid"]
      });
    });

    it("should identify all features as existing when all UUIDs exist in database", async () => {
      const geojson: FeatureCollection = {
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
            properties: { uuid: "uuid-1" }
          },
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
            properties: { uuid: "uuid-2" }
          }
        ]
      };

      const existingPolygons = [{ uuid: "uuid-1" } as SitePolygon, { uuid: "uuid-2" } as SitePolygon];

      jest.spyOn(SitePolygon, "findAll").mockResolvedValue(existingPolygons);

      const result = await service.compareUploadedFeaturesWithExisting(geojson, "site-uuid");

      expect(result).toEqual({
        existingUuids: ["uuid-1", "uuid-2"],
        totalFeatures: 2,
        featuresForVersioning: 2,
        featuresForCreation: 0
      });
    });

    it("should correctly split features between versioning and creation", async () => {
      const geojson: FeatureCollection = {
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
            properties: { uuid: "existing-uuid-1" }
          },
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
            properties: { uuid: "new-uuid-1" }
          },
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
            properties: { uuid: "existing-uuid-2" }
          },
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
            properties: {}
          }
        ]
      };

      const existingPolygons = [{ uuid: "existing-uuid-1" } as SitePolygon, { uuid: "existing-uuid-2" } as SitePolygon];

      jest.spyOn(SitePolygon, "findAll").mockResolvedValue(existingPolygons);

      const result = await service.compareUploadedFeaturesWithExisting(geojson, "site-uuid");

      expect(result).toEqual({
        existingUuids: ["existing-uuid-1", "existing-uuid-2"],
        totalFeatures: 4,
        featuresForVersioning: 2,
        featuresForCreation: 2
      });
    });

    it("should handle mixed features with and without UUIDs", async () => {
      const geojson: FeatureCollection = {
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
            properties: { uuid: "existing-uuid" }
          },
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
            properties: null
          },
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
            properties: { uuid: "new-uuid" }
          }
        ]
      };

      const existingPolygons = [{ uuid: "existing-uuid" } as SitePolygon];

      jest.spyOn(SitePolygon, "findAll").mockResolvedValue(existingPolygons);

      const result = await service.compareUploadedFeaturesWithExisting(geojson, "site-uuid");

      expect(result).toEqual({
        existingUuids: ["existing-uuid"],
        totalFeatures: 3,
        featuresForVersioning: 1,
        featuresForCreation: 2
      });
    });

    it("should use correct siteId in database query", async () => {
      const geojson: FeatureCollection = {
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
            properties: { uuid: "uuid-1" }
          }
        ]
      };

      jest.spyOn(SitePolygon, "findAll").mockResolvedValue([]);

      await service.compareUploadedFeaturesWithExisting(geojson, "specific-site-id");

      expect(SitePolygon.findAll).toHaveBeenCalledWith({
        where: {
          uuid: { [Op.in]: ["uuid-1"] },
          siteUuid: "specific-site-id",
          isActive: true
        },
        attributes: ["uuid"]
      });
    });

    it("should handle duplicate UUIDs in uploaded features", async () => {
      const geojson: FeatureCollection = {
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
            properties: { uuid: "uuid-1" }
          },
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
            properties: { uuid: "uuid-1" }
          }
        ]
      };

      const existingPolygons = [{ uuid: "uuid-1" } as SitePolygon];

      jest.spyOn(SitePolygon, "findAll").mockResolvedValue(existingPolygons);

      const result = await service.compareUploadedFeaturesWithExisting(geojson, "site-uuid");

      expect(result).toEqual({
        existingUuids: ["uuid-1"],
        totalFeatures: 2,
        featuresForVersioning: 2,
        featuresForCreation: 0
      });
    });

    it("should handle large number of features", async () => {
      const features = Array.from({ length: 100 }, (_, i) => ({
        type: "Feature" as const,
        geometry: {
          type: "Polygon" as const,
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
        properties: { uuid: `uuid-${i}` }
      }));

      const geojson: FeatureCollection = {
        type: "FeatureCollection",
        features
      };

      const existingPolygons = Array.from({ length: 50 }, (_, i) => ({
        uuid: `uuid-${i * 2}`
      })) as SitePolygon[];

      jest.spyOn(SitePolygon, "findAll").mockResolvedValue(existingPolygons);

      const result = await service.compareUploadedFeaturesWithExisting(geojson, "site-uuid");

      expect(result.totalFeatures).toBe(100);
      expect(result.featuresForVersioning).toBe(50);
      expect(result.featuresForCreation).toBe(50);
      expect(result.existingUuids).toHaveLength(50);
    });
  });
});

import { Test, TestingModule } from "@nestjs/testing";
import { SitePolygonCreationService } from "./site-polygon-creation.service";
import { PolygonGeometryCreationService } from "./polygon-geometry-creation.service";
import { PointGeometryCreationService } from "./point-geometry-creation.service";
import { DuplicateGeometryValidator } from "../validations/validators/duplicate-geometry.validator";
import { VoronoiService } from "../voronoi/voronoi.service";
import { Site, SitePolygon, PolygonGeometry } from "@terramatch-microservices/database/entities";
import { CreateSitePolygonBatchRequestDto, Feature } from "./dto/create-site-polygon-request.dto";
import { BadRequestException } from "@nestjs/common";

const mockTransaction = {
  commit: jest.fn(),
  rollback: jest.fn()
};

const mockSequelize = {
  transaction: jest.fn().mockResolvedValue(mockTransaction)
};

describe("SitePolygonCreationService", () => {
  let service: SitePolygonCreationService;
  let polygonGeometryService: PolygonGeometryCreationService;
  let duplicateGeometryValidator: DuplicateGeometryValidator;
  let pointGeometryService: PointGeometryCreationService;
  let voronoiService: VoronoiService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SitePolygonCreationService,
        {
          provide: PolygonGeometryCreationService,
          useValue: {
            createGeometriesFromFeatures: jest.fn(),
            bulkUpdateSitePolygonCentroids: jest.fn().mockResolvedValue(undefined),
            bulkUpdateSitePolygonAreas: jest.fn().mockResolvedValue(undefined),
            bulkUpdateProjectCentroids: jest.fn().mockResolvedValue(undefined)
          }
        },
        {
          provide: PointGeometryCreationService,
          useValue: {
            createPointGeometriesFromFeatures: jest.fn().mockResolvedValue([])
          }
        },
        {
          provide: DuplicateGeometryValidator,
          useValue: {
            checkNewFeaturesDuplicates: jest.fn().mockResolvedValue({
              valid: true,
              duplicates: []
            })
          }
        },
        {
          provide: VoronoiService,
          useValue: {
            transformPointsToPolygons: jest.fn().mockResolvedValue([])
          }
        }
      ]
    }).compile();

    service = module.get<SitePolygonCreationService>(SitePolygonCreationService);
    polygonGeometryService = module.get<PolygonGeometryCreationService>(PolygonGeometryCreationService);
    duplicateGeometryValidator = module.get<DuplicateGeometryValidator>(DuplicateGeometryValidator);
    pointGeometryService = module.get<PointGeometryCreationService>(PointGeometryCreationService);
    voronoiService = module.get<VoronoiService>(VoronoiService);

    Object.defineProperty(PolygonGeometry, "sequelize", {
      get: jest.fn(() => mockSequelize),
      configurable: true
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const createMockRequest = (features: Feature[]): CreateSitePolygonBatchRequestDto => ({
    geometries: [
      {
        type: "FeatureCollection",
        features
      }
    ]
  });

  describe("createSitePolygons", () => {
    const mockUserId = 1;

    it("should create site polygons successfully", async () => {
      const mockFeature: Feature = {
        type: "Feature",
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
        },
        properties: {
          site_id: "site-uuid-1",
          poly_name: "Test Polygon"
        }
      };

      const request = createMockRequest([mockFeature]);

      jest.spyOn(Site, "findAll").mockResolvedValue([{ uuid: "site-uuid-1" } as Site]);

      jest.spyOn(polygonGeometryService, "createGeometriesFromFeatures").mockResolvedValue({
        uuids: ["polygon-uuid-1"],
        areas: [10.5]
      });

      const mockSitePolygon = {
        uuid: "site-polygon-uuid-1",
        siteUuid: "site-uuid-1",
        polygonUuid: "polygon-uuid-1",
        polyName: "Test Polygon"
      } as SitePolygon;

      jest.spyOn(SitePolygon, "bulkCreate").mockResolvedValue([mockSitePolygon]);

      jest.spyOn(SitePolygon, "update").mockResolvedValue([1]);

      const result = await service.createSitePolygons(request, mockUserId, "test", null);

      expect(result.data).toHaveLength(1);
      expect(result.data[0].uuid).toBe("site-polygon-uuid-1");
      expect(result.data[0].siteUuid).toBe("site-uuid-1");
      expect(result.data[0].polygonUuid).toBe("polygon-uuid-1");
      expect(mockTransaction.commit).toHaveBeenCalled();
    });

    it("should handle MultiPolygon geometries", async () => {
      const mockFeature: Feature = {
        type: "Feature",
        geometry: {
          type: "MultiPolygon",
          coordinates: [
            [
              [
                [0, 0],
                [0, 1],
                [1, 1],
                [1, 0],
                [0, 0]
              ]
            ],
            [
              [
                [2, 2],
                [2, 3],
                [3, 3],
                [3, 2],
                [2, 2]
              ]
            ]
          ]
        },
        properties: {
          site_id: "site-uuid-1"
        }
      };

      const request = createMockRequest([mockFeature]);

      jest.spyOn(Site, "findAll").mockResolvedValue([{ uuid: "site-uuid-1" } as Site]);

      jest.spyOn(polygonGeometryService, "createGeometriesFromFeatures").mockResolvedValue({
        uuids: ["polygon-uuid-1", "polygon-uuid-2"],
        areas: [10.5, 8.3]
      });

      jest
        .spyOn(SitePolygon, "bulkCreate")
        .mockResolvedValue([
          { uuid: "site-polygon-uuid-1", polyName: null } as SitePolygon,
          { uuid: "site-polygon-uuid-2", polyName: null } as SitePolygon
        ]);

      jest.spyOn(SitePolygon, "update").mockResolvedValue([1]);

      const result = await service.createSitePolygons(request, mockUserId, "test", null);

      expect(result.data).toHaveLength(2);
      expect(polygonGeometryService.createGeometriesFromFeatures).toHaveBeenCalled();
    });

    it("should group polygons by site and geometry type", async () => {
      const features: Feature[] = [
        {
          type: "Feature",
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
          },
          properties: { site_id: "site-1" }
        },
        {
          type: "Feature",
          geometry: {
            type: "Polygon",
            coordinates: [
              [
                [2, 2],
                [2, 3],
                [3, 3],
                [3, 2],
                [2, 2]
              ]
            ]
          },
          properties: { site_id: "site-2" }
        },
        {
          type: "Feature",
          geometry: {
            type: "MultiPolygon",
            coordinates: [
              [
                [
                  [0, 0],
                  [0, 1],
                  [1, 1],
                  [1, 0],
                  [0, 0]
                ]
              ]
            ]
          },
          properties: { site_id: "site-1" }
        }
      ];

      const request = createMockRequest(features);

      jest.spyOn(Site, "findAll").mockResolvedValue([{ uuid: "site-1" } as Site, { uuid: "site-2" } as Site]);

      jest.spyOn(polygonGeometryService, "createGeometriesFromFeatures").mockResolvedValue({
        uuids: ["uuid-1", "uuid-2"],
        areas: [10, 20]
      });

      jest
        .spyOn(SitePolygon, "bulkCreate")
        .mockResolvedValue([
          { uuid: "sp-1", polyName: null } as SitePolygon,
          { uuid: "sp-2", polyName: null } as SitePolygon
        ]);

      jest.spyOn(SitePolygon, "update").mockResolvedValue([1]);

      const result = await service.createSitePolygons(request, mockUserId, "test", null);

      expect(result.data.length).toBeGreaterThan(0);
    });
  });

  describe("grouping logic", () => {
    describe("duplicate validation", () => {
      const mockUserId = 1;

      it("should return validation data when duplicates are found", async () => {
        const mockFeature: Feature = {
          type: "Feature",
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
          },
          properties: {
            site_id: "site-uuid-1",
            poly_name: "Test Polygon"
          }
        };

        const request = createMockRequest([mockFeature]);

        jest.spyOn(duplicateGeometryValidator, "checkNewFeaturesDuplicates").mockResolvedValue({
          valid: true,
          duplicates: []
        });

        jest.spyOn(Site, "findAll").mockResolvedValue([{ uuid: "site-uuid-1" } as Site]);

        jest.spyOn(polygonGeometryService, "createGeometriesFromFeatures").mockResolvedValue({
          uuids: ["polygon-uuid-1"],
          areas: [10.5]
        });

        jest.spyOn(SitePolygon, "bulkCreate").mockResolvedValue([
          {
            uuid: "site-polygon-uuid-1",
            siteUuid: "site-uuid-1",
            polygonUuid: "polygon-uuid-1",
            polyName: null
          } as SitePolygon
        ]);

        jest.spyOn(SitePolygon, "update").mockResolvedValue([1]);

        const result = await service.createSitePolygons(request, mockUserId, "test", null);

        expect(result.data).toHaveLength(1);
        expect(result.included).toHaveLength(0);
      });

      it("should include validation data when duplicates are found", async () => {
        const mockFeature: Feature = {
          type: "Feature",
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
          },
          properties: {
            site_id: "site-uuid-1",
            poly_name: "Test Polygon"
          }
        };

        const request = createMockRequest([mockFeature]);

        jest.spyOn(duplicateGeometryValidator, "checkNewFeaturesDuplicates").mockResolvedValue({
          valid: false,
          duplicates: [{ index: 0, existing_uuid: "existing-polygon-uuid" }]
        });

        jest.spyOn(Site, "findAll").mockResolvedValue([{ uuid: "site-uuid-1" } as Site]);

        jest.spyOn(SitePolygon, "findAll").mockResolvedValue([
          {
            uuid: "existing-site-polygon-uuid",
            polygonUuid: "existing-polygon-uuid",
            polyName: "Existing Polygon"
          } as SitePolygon
        ]);

        jest.spyOn(SitePolygon, "bulkCreate").mockResolvedValue([]);

        const result = await service.createSitePolygons(request, mockUserId, "test", null);

        expect(result.data).toHaveLength(1);
        expect(result.included).toHaveLength(1);
        expect(result.included[0].attributes.polygonUuid).toBe("existing-polygon-uuid");
        expect(result.included[0].attributes.criteriaList[0].criteriaId).toBe(16);
        expect(result.included[0].attributes.criteriaList[0].valid).toBe(false);
      });
    });
  });

  describe("Point feature transformation", () => {
    const mockUserId = 1;

    it("should transform Point features to polygons via Voronoi", async () => {
      const pointFeature: Feature = {
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [0, 0]
        },
        properties: {
          site_id: "site-uuid-1",
          est_area: 10.5
        }
      };

      const request = createMockRequest([pointFeature]);

      jest.spyOn(Site, "findAll").mockResolvedValue([{ uuid: "site-uuid-1" } as Site]);

      jest.spyOn(pointGeometryService, "createPointGeometriesFromFeatures").mockResolvedValue(["point-uuid-1"]);

      const voronoiPolygon: Feature = {
        type: "Feature",
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
        },
        properties: {
          site_id: "site-uuid-1"
        }
      };

      jest.spyOn(voronoiService, "transformPointsToPolygons").mockResolvedValue([voronoiPolygon]);

      jest.spyOn(polygonGeometryService, "createGeometriesFromFeatures").mockResolvedValue({
        uuids: ["polygon-uuid-1"],
        areas: [10.5]
      });

      jest.spyOn(SitePolygon, "bulkCreate").mockResolvedValue([
        {
          uuid: "site-polygon-uuid-1",
          polygonUuid: "polygon-uuid-1",
          polyName: null
        } as SitePolygon
      ]);

      jest.spyOn(SitePolygon, "update").mockResolvedValue([1]);

      await service.createSitePolygons(request, mockUserId, "test", null);

      expect(pointGeometryService.createPointGeometriesFromFeatures).toHaveBeenCalled();
      expect(pointFeature.properties._pointUuid).toBe("point-uuid-1");
      expect(voronoiService.transformPointsToPolygons).toHaveBeenCalled();
      expect(mockTransaction.commit).toHaveBeenCalled();
    });

    it("should throw error when Point feature missing est_area", async () => {
      const pointFeature: Feature = {
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [0, 0]
        },
        properties: {
          site_id: "site-uuid-1"
        }
      };

      const request = createMockRequest([pointFeature]);

      jest.spyOn(Site, "findAll").mockResolvedValue([{ uuid: "site-uuid-1" } as Site]);

      await expect(service.createSitePolygons(request, mockUserId, "test", null)).rejects.toThrow(
        new BadRequestException("Point features must include properties.est_area")
      );
      expect(mockTransaction.rollback).toHaveBeenCalled();
    });

    it("should throw error when Point feature missing site_id", async () => {
      const pointFeature = {
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [0, 0]
        },
        properties: {
          est_area: 10.5
        }
      } as unknown as Feature;

      const request = createMockRequest([pointFeature]);

      jest.spyOn(Site, "findAll").mockResolvedValue([{ uuid: "site-uuid-1" } as Site]);

      await expect(service.createSitePolygons(request, mockUserId, "test", null)).rejects.toThrow(
        new BadRequestException("All features must have site_id in properties")
      );
      expect(mockTransaction.rollback).toHaveBeenCalled();
    });

    it("should handle case where point count exceeds UUID count", async () => {
      const pointFeature1: Feature = {
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [0, 0]
        },
        properties: {
          site_id: "site-uuid-1",
          est_area: 10.5
        }
      };

      const pointFeature2: Feature = {
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [1, 1]
        },
        properties: {
          site_id: "site-uuid-1",
          est_area: 5.0
        }
      };

      const request = createMockRequest([pointFeature1, pointFeature2]);

      jest.spyOn(Site, "findAll").mockResolvedValue([{ uuid: "site-uuid-1" } as Site]);

      // Return fewer UUIDs than points to test the loop condition
      jest.spyOn(pointGeometryService, "createPointGeometriesFromFeatures").mockResolvedValue(["point-uuid-1"]);

      const voronoiPolygon: Feature = {
        type: "Feature",
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
        },
        properties: {
          site_id: "site-uuid-1"
        }
      };

      jest.spyOn(voronoiService, "transformPointsToPolygons").mockResolvedValue([voronoiPolygon]);

      jest.spyOn(polygonGeometryService, "createGeometriesFromFeatures").mockResolvedValue({
        uuids: ["polygon-uuid-1"],
        areas: [10.5]
      });

      jest.spyOn(SitePolygon, "bulkCreate").mockResolvedValue([
        {
          uuid: "site-polygon-uuid-1",
          polygonUuid: "polygon-uuid-1",
          polyName: null
        } as SitePolygon
      ]);

      jest.spyOn(SitePolygon, "update").mockResolvedValue([1]);

      await service.createSitePolygons(request, mockUserId, "test", null);

      // Only first point should have _pointUuid set
      expect(pointFeature1.properties._pointUuid).toBe("point-uuid-1");
      expect(pointFeature2.properties._pointUuid).toBeUndefined();
      expect(mockTransaction.commit).toHaveBeenCalled();
    });

    it("should mix Point and Polygon features", async () => {
      const pointFeature: Feature = {
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [0, 0]
        },
        properties: {
          site_id: "site-uuid-1",
          est_area: 10.5
        }
      };

      const polygonFeature: Feature = {
        type: "Feature",
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [1, 1],
              [1, 2],
              [2, 2],
              [2, 1],
              [1, 1]
            ]
          ]
        },
        properties: {
          site_id: "site-uuid-1"
        }
      };

      const request = createMockRequest([pointFeature, polygonFeature]);

      jest.spyOn(Site, "findAll").mockResolvedValue([{ uuid: "site-uuid-1" } as Site]);

      jest.spyOn(pointGeometryService, "createPointGeometriesFromFeatures").mockResolvedValue(["point-uuid-1"]);

      const voronoiPolygon: Feature = {
        type: "Feature",
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
        },
        properties: {
          site_id: "site-uuid-1"
        }
      };

      jest.spyOn(voronoiService, "transformPointsToPolygons").mockResolvedValue([voronoiPolygon]);

      jest.spyOn(polygonGeometryService, "createGeometriesFromFeatures").mockResolvedValue({
        uuids: ["polygon-uuid-1", "polygon-uuid-2"],
        areas: [10.5, 5.0]
      });

      jest.spyOn(SitePolygon, "bulkCreate").mockResolvedValue([
        {
          uuid: "site-polygon-uuid-1",
          polygonUuid: "polygon-uuid-1",
          polyName: null
        } as SitePolygon,
        {
          uuid: "site-polygon-uuid-2",
          polygonUuid: "polygon-uuid-2",
          polyName: null
        } as SitePolygon
      ]);

      jest.spyOn(SitePolygon, "update").mockResolvedValue([1]);

      await service.createSitePolygons(request, mockUserId, "test", null);

      expect(pointGeometryService.createPointGeometriesFromFeatures).toHaveBeenCalled();
      expect(voronoiService.transformPointsToPolygons).toHaveBeenCalled();
      expect(polygonGeometryService.createGeometriesFromFeatures).toHaveBeenCalled();
      expect(mockTransaction.commit).toHaveBeenCalled();
    });
  });
});

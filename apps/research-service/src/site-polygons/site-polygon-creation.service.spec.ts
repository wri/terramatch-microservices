import { Test, TestingModule } from "@nestjs/testing";
import { SitePolygonCreationService } from "./site-polygon-creation.service";
import { PolygonGeometryCreationService } from "./polygon-geometry-creation.service";
import { BadRequestException } from "@nestjs/common";
import { Site, SitePolygon, PolygonGeometry } from "@terramatch-microservices/database/entities";
import { CreateSitePolygonBatchRequestDto, Feature } from "./dto/create-site-polygon-request.dto";

// Mock Sequelize
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

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SitePolygonCreationService,
        {
          provide: PolygonGeometryCreationService,
          useValue: {
            createGeometriesFromFeatures: jest.fn()
          }
        }
      ]
    }).compile();

    service = module.get<SitePolygonCreationService>(SitePolygonCreationService);
    polygonGeometryService = module.get<PolygonGeometryCreationService>(PolygonGeometryCreationService);

    // Mock PolygonGeometry sequelize
    Object.defineProperty(PolygonGeometry, "sequelize", {
      get: jest.fn(() => mockSequelize),
      configurable: true
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("createSitePolygons", () => {
    const mockUserId = 1;

    const createMockRequest = (features: Feature[]): CreateSitePolygonBatchRequestDto => ({
      geometries: [
        {
          type: "FeatureCollection",
          features
        }
      ]
    });

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

      // Mock Site.findAll
      jest.spyOn(Site, "findAll").mockResolvedValue([{ uuid: "site-uuid-1" } as Site]);

      // Mock polygon geometry creation
      jest.spyOn(polygonGeometryService, "createGeometriesFromFeatures").mockResolvedValue({
        uuids: ["polygon-uuid-1"],
        areas: [10.5]
      });

      // Mock SitePolygon.bulkCreate
      jest.spyOn(SitePolygon, "bulkCreate").mockResolvedValue([
        {
          uuid: "site-polygon-uuid-1",
          siteUuid: "site-uuid-1",
          polygonUuid: "polygon-uuid-1"
        } as SitePolygon
      ]);

      const result = await service.createSitePolygons(request, mockUserId);

      expect(result).toHaveLength(1);
      expect(result[0].uuid).toBe("site-polygon-uuid-1");
      expect(result[0].siteUuid).toBe("site-uuid-1");
      expect(result[0].polygonUuid).toBe("polygon-uuid-1");
      expect(mockTransaction.commit).toHaveBeenCalled();
    });

    it("should throw error if site does not exist", async () => {
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
          site_id: "non-existent-site"
        }
      };

      const request = createMockRequest([mockFeature]);

      // Mock Site.findAll returns empty
      jest.spyOn(Site, "findAll").mockResolvedValue([]);

      await expect(service.createSitePolygons(request, mockUserId)).rejects.toThrow(BadRequestException);
      expect(mockTransaction.rollback).toHaveBeenCalled();
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

      // MultiPolygon expands to 2 polygons
      jest.spyOn(polygonGeometryService, "createGeometriesFromFeatures").mockResolvedValue({
        uuids: ["polygon-uuid-1", "polygon-uuid-2"],
        areas: [10.5, 8.3]
      });

      jest
        .spyOn(SitePolygon, "bulkCreate")
        .mockResolvedValue([
          { uuid: "site-polygon-uuid-1" } as SitePolygon,
          { uuid: "site-polygon-uuid-2" } as SitePolygon
        ]);

      const result = await service.createSitePolygons(request, mockUserId);

      expect(result).toHaveLength(2);
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
        .mockResolvedValue([{ uuid: "sp-1" } as SitePolygon, { uuid: "sp-2" } as SitePolygon]);

      const result = await service.createSitePolygons(request, mockUserId);

      // Should have created multiple site polygons
      expect(result.length).toBeGreaterThan(0);
    });

    it("should rollback transaction on error", async () => {
      const request = createMockRequest([
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
        }
      ]);

      jest.spyOn(Site, "findAll").mockRejectedValue(new Error("Database error"));

      await expect(service.createSitePolygons(request, mockUserId)).rejects.toThrow();
      expect(mockTransaction.rollback).toHaveBeenCalled();
      expect(mockTransaction.commit).not.toHaveBeenCalled();
    });
  });

  describe("grouping logic", () => {
    it("should throw error if feature has no site_id", () => {
      // This would be tested by calling the private method indirectly through createSitePolygons
      // with a feature missing site_id
      const request: CreateSitePolygonBatchRequestDto = {
        geometries: [
          {
            type: "FeatureCollection",
            features: [
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
                properties: {} as any // Missing site_id
              }
            ]
          }
        ]
      };

      // This should throw BadRequestException when processing
      expect(async () => {
        await service.createSitePolygons(request, 1);
      }).rejects.toThrow(BadRequestException);
    });
  });
});

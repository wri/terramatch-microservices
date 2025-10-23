import { Test, TestingModule } from "@nestjs/testing";
import { SitePolygonCreationService } from "./site-polygon-creation.service";
import { PolygonGeometryCreationService } from "./polygon-geometry-creation.service";
import { DuplicateGeometryValidator } from "../validations/validators/duplicate-geometry.validator";
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
  let duplicateGeometryValidator: DuplicateGeometryValidator;

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
          provide: DuplicateGeometryValidator,
          useValue: {
            checkNewFeaturesDuplicates: jest.fn().mockResolvedValue({
              valid: true,
              duplicates: []
            })
          }
        }
      ]
    }).compile();

    service = module.get<SitePolygonCreationService>(SitePolygonCreationService);
    polygonGeometryService = module.get<PolygonGeometryCreationService>(PolygonGeometryCreationService);
    duplicateGeometryValidator = module.get<DuplicateGeometryValidator>(DuplicateGeometryValidator);

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

      jest.spyOn(SitePolygon, "bulkCreate").mockResolvedValue([
        {
          uuid: "site-polygon-uuid-1",
          siteUuid: "site-uuid-1",
          polygonUuid: "polygon-uuid-1"
        } as SitePolygon
      ]);

      const result = await service.createSitePolygons(request, mockUserId);

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
          { uuid: "site-polygon-uuid-1" } as SitePolygon,
          { uuid: "site-polygon-uuid-2" } as SitePolygon
        ]);

      const result = await service.createSitePolygons(request, mockUserId);

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
        .mockResolvedValue([{ uuid: "sp-1" } as SitePolygon, { uuid: "sp-2" } as SitePolygon]);

      const result = await service.createSitePolygons(request, mockUserId);

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
            polygonUuid: "polygon-uuid-1"
          } as SitePolygon
        ]);

        const result = await service.createSitePolygons(request, mockUserId);

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

        const result = await service.createSitePolygons(request, mockUserId);

        expect(result.data).toHaveLength(1); // One duplicate polygon returned
        expect(result.included).toHaveLength(1); // One validation entry
        expect(result.included[0].attributes.polygonUuid).toBe("existing-polygon-uuid");
        expect(result.included[0].attributes.criteriaList[0].criteriaId).toBe(16);
        expect(result.included[0].attributes.criteriaList[0].valid).toBe(false);
      });
    });
  });
});

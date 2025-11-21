import { Test, TestingModule } from "@nestjs/testing";
import { PolygonSizeValidator } from "./polygon-size.validator";
import { SitePolygon, PolygonGeometry } from "@terramatch-microservices/database/entities";
import { NotFoundException } from "@nestjs/common";
import { Point, Polygon, MultiPolygon } from "geojson";

jest.mock("@terramatch-microservices/database/entities", () => {
  const mockQuery = jest.fn();
  return {
    SitePolygon: {
      findOne: jest.fn(),
      findAll: jest.fn()
    },
    PolygonGeometry: {
      sequelize: { query: mockQuery }
    }
  };
});

describe("PolygonSizeValidator", () => {
  let validator: PolygonSizeValidator;
  let mockFindOne: jest.MockedFunction<typeof SitePolygon.findOne>;
  let mockFindAll: jest.MockedFunction<typeof SitePolygon.findAll>;

  beforeEach(async () => {
    jest.spyOn(SitePolygon, "findOne").mockImplementation(jest.fn());
    jest.spyOn(SitePolygon, "findAll").mockImplementation(jest.fn());
    mockFindOne = SitePolygon.findOne as jest.MockedFunction<typeof SitePolygon.findOne>;
    mockFindAll = SitePolygon.findAll as jest.MockedFunction<typeof SitePolygon.findAll>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [PolygonSizeValidator]
    }).compile();

    validator = module.get<PolygonSizeValidator>(PolygonSizeValidator);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("validatePolygon", () => {
    it("should return valid=true for polygon within size limit", async () => {
      const polygonUuid = "test-uuid-1";
      const mockSitePolygon = { calcArea: 500 } as SitePolygon;
      mockFindOne.mockResolvedValue(mockSitePolygon);

      const result = await validator.validatePolygon(polygonUuid);

      expect(result).toEqual({
        valid: true,
        extraInfo: {
          area_hectares: 500
        }
      });
      expect(mockFindOne).toHaveBeenCalledWith({
        where: { polygonUuid, isActive: true },
        attributes: ["calcArea"]
      });
    });

    it("should return valid=false for polygon exceeding size limit", async () => {
      const polygonUuid = "test-uuid-2";
      const mockSitePolygon = { calcArea: 1500 } as SitePolygon;
      mockFindOne.mockResolvedValue(mockSitePolygon);

      const result = await validator.validatePolygon(polygonUuid);

      expect(result).toEqual({
        valid: false,
        extraInfo: {
          area_hectares: 1500
        }
      });
    });

    it("should return valid=true for polygon at exact size limit", async () => {
      const polygonUuid = "test-uuid-3";
      const mockSitePolygon = { calcArea: 1000 } as SitePolygon;
      mockFindOne.mockResolvedValue(mockSitePolygon);

      const result = await validator.validatePolygon(polygonUuid);

      expect(result).toEqual({
        valid: true,
        extraInfo: {
          area_hectares: 1000
        }
      });
    });

    it("should handle null calcArea as 0", async () => {
      const polygonUuid = "test-uuid-4";
      const mockSitePolygon = { calcArea: null } as SitePolygon;
      mockFindOne.mockResolvedValue(mockSitePolygon);

      const result = await validator.validatePolygon(polygonUuid);

      expect(result).toEqual({
        valid: true,
        extraInfo: {
          area_hectares: 0
        }
      });
    });

    it("should throw error when polygon is not found", async () => {
      const polygonUuid = "non-existent-uuid";
      mockFindOne.mockResolvedValue(null);

      await expect(validator.validatePolygon(polygonUuid)).rejects.toThrow(
        new NotFoundException(`Polygon with UUID ${polygonUuid} not found`)
      );
    });

    it("should handle database query errors", async () => {
      const polygonUuid = "test-uuid";
      const dbError = new Error("Database connection failed");
      mockFindOne.mockRejectedValue(dbError);

      await expect(validator.validatePolygon(polygonUuid)).rejects.toThrow(dbError);
    });
  });

  describe("validatePolygons", () => {
    it("should validate multiple polygons successfully", async () => {
      const polygonUuids = ["uuid-1", "uuid-2", "uuid-3"];
      const mockResults = [
        { polygonUuid: "uuid-1", calcArea: 500 } as SitePolygon,
        { polygonUuid: "uuid-2", calcArea: 1500 } as SitePolygon,
        { polygonUuid: "uuid-3", calcArea: 1000 } as SitePolygon
      ];
      mockFindAll.mockResolvedValue(mockResults);

      const result = await validator.validatePolygons(polygonUuids);

      expect(result).toEqual([
        {
          polygonUuid: "uuid-1",
          valid: true,
          extraInfo: {
            area_hectares: 500
          }
        },
        {
          polygonUuid: "uuid-2",
          valid: false,
          extraInfo: {
            area_hectares: 1500
          }
        },
        {
          polygonUuid: "uuid-3",
          valid: true,
          extraInfo: {
            area_hectares: 1000
          }
        }
      ]);
      expect(mockFindAll).toHaveBeenCalledWith({
        where: {
          polygonUuid: polygonUuids,
          isActive: true
        },
        attributes: ["polygonUuid", "calcArea"]
      });
    });

    it("should handle missing polygons in results", async () => {
      const polygonUuids = ["uuid-1", "uuid-2", "uuid-3"];
      const mockResults = [
        { polygonUuid: "uuid-1", calcArea: 500 } as SitePolygon,
        { polygonUuid: "uuid-3", calcArea: 1500 } as SitePolygon
      ];
      mockFindAll.mockResolvedValue(mockResults);

      const result = await validator.validatePolygons(polygonUuids);

      expect(result).toEqual([
        {
          polygonUuid: "uuid-1",
          valid: true,
          extraInfo: {
            area_hectares: 500
          }
        },
        {
          polygonUuid: "uuid-2",
          valid: true,
          extraInfo: {
            area_hectares: 0
          }
        },
        {
          polygonUuid: "uuid-3",
          valid: false,
          extraInfo: {
            area_hectares: 1500
          }
        }
      ]);
    });

    it("should handle empty polygon list", async () => {
      const polygonUuids: string[] = [];
      mockFindAll.mockResolvedValue([]);

      const result = await validator.validatePolygons(polygonUuids);

      expect(result).toEqual([]);
      expect(mockFindAll).toHaveBeenCalledWith({
        where: {
          polygonUuid: [],
          isActive: true
        },
        attributes: ["polygonUuid", "calcArea"]
      });
    });

    it("should handle null calcArea values", async () => {
      const polygonUuids = ["uuid-1", "uuid-2"];
      const mockResults = [
        { polygonUuid: "uuid-1", calcArea: null } as SitePolygon,
        { polygonUuid: "uuid-2", calcArea: 500 } as SitePolygon
      ];
      mockFindAll.mockResolvedValue(mockResults);

      const result = await validator.validatePolygons(polygonUuids);

      expect(result).toEqual([
        {
          polygonUuid: "uuid-1",
          valid: true,
          extraInfo: {
            area_hectares: 0
          }
        },
        {
          polygonUuid: "uuid-2",
          valid: true,
          extraInfo: {
            area_hectares: 500
          }
        }
      ]);
    });

    it("should handle database query errors", async () => {
      const polygonUuids = ["uuid-1"];
      const dbError = new Error("Database connection failed");
      mockFindAll.mockRejectedValue(dbError);

      await expect(validator.validatePolygons(polygonUuids)).rejects.toThrow(dbError);
    });
  });

  describe("validateGeometry", () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    afterEach(() => {
      jest.clearAllMocks();
    });

    it("should return valid=true for Point geometry", async () => {
      const geometry: Point = { type: "Point", coordinates: [0, 0] };
      const result = await validator.validateGeometry(geometry);
      expect(result.valid).toBe(true);
      expect(result.extraInfo).not.toBeNull();
      expect(result.extraInfo?.area_hectares).toBe(0);
    });

    it("should return valid=true for Polygon within size limit", async () => {
      const geometry: Polygon = {
        type: "Polygon",
        coordinates: [
          [
            [0, 0],
            [0, 0.01],
            [0.01, 0.01],
            [0.01, 0],
            [0, 0]
          ]
        ]
      };
      // Mock area that results in < 1,000,000 sq meters
      // Calculation: areaSqMeters = areaSqDegrees * (111320 * cos(latitudeRad))^2
      // For areaSqDegrees = 0.00008 and latitude = 0.005:
      // areaSqMeters ≈ 0.00008 * (111320 * cos(0.005 * π/180))^2 ≈ 991,371 sq meters (< 1,000,000)
      (
        PolygonGeometry.sequelize?.query as unknown as jest.MockedFunction<
          (...args: unknown[]) => Promise<Array<{ area: number; latitude: number }>>
        >
      ).mockResolvedValue([{ area: 0.00008, latitude: 0.005 }]);
      const result = await validator.validateGeometry(geometry);
      expect(result.valid).toBe(true);
      expect(result.extraInfo).not.toBeNull();
      expect(result.extraInfo?.area_hectares).toBeGreaterThanOrEqual(0);
    });

    it("should return valid=false for Polygon exceeding size limit", async () => {
      const geometry: Polygon = {
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
      };
      // Mock large area (exceeding 1,000,000 sq meters)
      // areaSqMeters = 1.0 * (111320 * cos(0.5 * π/180))^2 ≈ 12,392,142,400 sq meters (way over limit)
      (
        PolygonGeometry.sequelize?.query as unknown as jest.MockedFunction<
          (...args: unknown[]) => Promise<Array<{ area: number; latitude: number }>>
        >
      ).mockResolvedValue([{ area: 1.0, latitude: 0.5 }]);
      const result = await validator.validateGeometry(geometry);
      expect(result.valid).toBe(false);
    });

    it("should return valid=true for MultiPolygon within size limit", async () => {
      const geometry: MultiPolygon = {
        type: "MultiPolygon",
        coordinates: [
          [
            [
              [0, 0],
              [0, 0.01],
              [0.01, 0.01],
              [0.01, 0],
              [0, 0]
            ]
          ]
        ]
      };
      // Mock area that results in < 1,000,000 sq meters (same as Polygon test)
      (
        PolygonGeometry.sequelize?.query as unknown as jest.MockedFunction<
          (...args: unknown[]) => Promise<Array<{ area: number; latitude: number }>>
        >
      ).mockResolvedValue([{ area: 0.00008, latitude: 0.005 }]);
      const result = await validator.validateGeometry(geometry);
      expect(result.valid).toBe(true);
    });

    it("should throw error when sequelize connection is missing", async () => {
      (PolygonGeometry as unknown as { sequelize: null }).sequelize = null;
      const geometry: Polygon = { type: "Polygon", coordinates: [] };
      const { InternalServerErrorException } = await import("@nestjs/common");
      await expect(validator.validateGeometry(geometry)).rejects.toThrow(InternalServerErrorException);
    });
  });
});

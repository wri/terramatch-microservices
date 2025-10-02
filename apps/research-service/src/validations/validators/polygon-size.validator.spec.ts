import { Test, TestingModule } from "@nestjs/testing";
import { PolygonSizeValidator } from "./polygon-size.validator";
import { SitePolygon } from "@terramatch-microservices/database/entities";
import { NotFoundException } from "@nestjs/common";

jest.mock("@terramatch-microservices/database/entities", () => ({
  SitePolygon: {
    findOne: jest.fn(),
    findAll: jest.fn()
  }
}));

describe("PolygonSizeValidator", () => {
  let validator: PolygonSizeValidator;
  let mockFindOne: jest.MockedFunction<typeof SitePolygon.findOne>;
  let mockFindAll: jest.MockedFunction<typeof SitePolygon.findAll>;

  beforeEach(async () => {
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
          areaHectares: 500,
          maxAllowedHectares: 1000
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
          areaHectares: 1500,
          maxAllowedHectares: 1000
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
          areaHectares: 1000,
          maxAllowedHectares: 1000
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
          areaHectares: 0,
          maxAllowedHectares: 1000
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
            areaHectares: 500,
            maxAllowedHectares: 1000
          }
        },
        {
          polygonUuid: "uuid-2",
          valid: false,
          extraInfo: {
            areaHectares: 1500,
            maxAllowedHectares: 1000
          }
        },
        {
          polygonUuid: "uuid-3",
          valid: true,
          extraInfo: {
            areaHectares: 1000,
            maxAllowedHectares: 1000
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
            areaHectares: 500,
            maxAllowedHectares: 1000
          }
        },
        {
          polygonUuid: "uuid-2",
          valid: true,
          extraInfo: {
            areaHectares: 0,
            maxAllowedHectares: 1000
          }
        },
        {
          polygonUuid: "uuid-3",
          valid: false,
          extraInfo: {
            areaHectares: 1500,
            maxAllowedHectares: 1000
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
            areaHectares: 0,
            maxAllowedHectares: 1000
          }
        },
        {
          polygonUuid: "uuid-2",
          valid: true,
          extraInfo: {
            areaHectares: 500,
            maxAllowedHectares: 1000
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
});

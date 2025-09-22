import { Test, TestingModule } from "@nestjs/testing";
import { SelfIntersectionValidator } from "./self-intersection.validator";
import { PolygonGeometry } from "@terramatch-microservices/database/entities";

interface MockSequelize {
  query: jest.MockedFunction<
    (sql: string, options: { replacements: Record<string, unknown>; type: string }) => Promise<unknown[]>
  >;
}

jest.mock("@terramatch-microservices/database/entities", () => ({
  PolygonGeometry: {
    sequelize: null
  }
}));

describe("SelfIntersectionValidator", () => {
  let validator: SelfIntersectionValidator;
  let mockSequelize: MockSequelize;

  beforeEach(async () => {
    mockSequelize = {
      query: jest.fn()
    } as MockSequelize;

    Object.defineProperty(PolygonGeometry, "sequelize", {
      get: () => mockSequelize,
      configurable: true
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [SelfIntersectionValidator]
    }).compile();

    validator = module.get<SelfIntersectionValidator>(SelfIntersectionValidator);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("validatePolygon", () => {
    it("should return valid=true for simple polygon", async () => {
      const polygonUuid = "test-uuid-1";
      mockSequelize.query.mockResolvedValue([{ is_simple: true }]);

      const result = await validator.validatePolygon(polygonUuid);

      expect(result).toEqual({
        valid: true,
        extraInfo: null
      });
      expect(mockSequelize.query).toHaveBeenCalledWith(expect.stringContaining("ST_IsSimple(geom) as is_simple"), {
        replacements: { polygonUuid },
        type: "SELECT"
      });
    });

    it("should return valid=false for self-intersecting polygon", async () => {
      const polygonUuid = "test-uuid-2";
      mockSequelize.query.mockResolvedValue([{ is_simple: false }]);

      const result = await validator.validatePolygon(polygonUuid);

      expect(result).toEqual({
        valid: false,
        extraInfo: null
      });
    });

    it("should throw error when polygon is not found", async () => {
      const polygonUuid = "non-existent-uuid";
      mockSequelize.query.mockResolvedValue([]);

      await expect(validator.validatePolygon(polygonUuid)).rejects.toThrow(
        `Polygon with UUID ${polygonUuid} not found`
      );
    });

    it("should throw error when sequelize connection is missing", async () => {
      Object.defineProperty(PolygonGeometry, "sequelize", {
        get: () => null,
        configurable: true
      });

      const polygonUuid = "test-uuid";

      await expect(validator.validatePolygon(polygonUuid)).rejects.toThrow(
        "PolygonGeometry model is missing sequelize connection"
      );
    });

    it("should handle database query errors", async () => {
      const polygonUuid = "test-uuid";
      const dbError = new Error("Database connection failed");
      mockSequelize.query.mockRejectedValue(dbError);

      await expect(validator.validatePolygon(polygonUuid)).rejects.toThrow(dbError);
    });
  });

  describe("validatePolygons", () => {
    it("should validate multiple polygons successfully", async () => {
      const polygonUuids = ["uuid-1", "uuid-2", "uuid-3"];
      const mockResults = [
        { uuid: "uuid-1", is_simple: true },
        { uuid: "uuid-2", is_simple: false },
        { uuid: "uuid-3", is_simple: true }
      ];
      mockSequelize.query.mockResolvedValue(mockResults);

      const result = await validator.validatePolygons(polygonUuids);

      expect(result).toEqual([
        { polygonUuid: "uuid-1", valid: true, extraInfo: null },
        { polygonUuid: "uuid-2", valid: false, extraInfo: null },
        { polygonUuid: "uuid-3", valid: true, extraInfo: null }
      ]);
      expect(mockSequelize.query).toHaveBeenCalledWith(expect.stringContaining("ST_IsSimple(geom) as is_simple"), {
        replacements: { polygonUuids },
        type: "SELECT"
      });
    });

    it("should handle missing polygons in results", async () => {
      const polygonUuids = ["uuid-1", "uuid-2", "uuid-3"];
      const mockResults = [
        { uuid: "uuid-1", is_simple: true },
        { uuid: "uuid-3", is_simple: false }
      ];
      mockSequelize.query.mockResolvedValue(mockResults);

      const result = await validator.validatePolygons(polygonUuids);

      expect(result).toEqual([
        { polygonUuid: "uuid-1", valid: true, extraInfo: null },
        { polygonUuid: "uuid-2", valid: false, extraInfo: null },
        { polygonUuid: "uuid-3", valid: false, extraInfo: null }
      ]);
    });

    it("should handle empty polygon list", async () => {
      const polygonUuids: string[] = [];
      mockSequelize.query.mockResolvedValue([]);

      const result = await validator.validatePolygons(polygonUuids);

      expect(result).toEqual([]);
      expect(mockSequelize.query).toHaveBeenCalledWith(expect.stringContaining("ST_IsSimple(geom) as is_simple"), {
        replacements: { polygonUuids: [] },
        type: "SELECT"
      });
    });

    it("should throw error when sequelize connection is missing", async () => {
      Object.defineProperty(PolygonGeometry, "sequelize", {
        get: () => null,
        configurable: true
      });

      const polygonUuids = ["uuid-1"];

      await expect(validator.validatePolygons(polygonUuids)).rejects.toThrow(
        "PolygonGeometry model is missing sequelize connection"
      );
    });

    it("should handle database query errors", async () => {
      const polygonUuids = ["uuid-1"];
      const dbError = new Error("Database connection failed");
      mockSequelize.query.mockRejectedValue(dbError);

      await expect(validator.validatePolygons(polygonUuids)).rejects.toThrow(dbError);
    });
  });
});

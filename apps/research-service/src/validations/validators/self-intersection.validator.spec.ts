import { Test, TestingModule } from "@nestjs/testing";
import { SelfIntersectionValidator } from "./self-intersection.validator";
import { PolygonGeometry } from "@terramatch-microservices/database/entities";

jest.mock("@terramatch-microservices/database/entities", () => ({
  PolygonGeometry: {
    sequelize: null,
    checkIsSimple: jest.fn(),
    checkIsSimpleBatch: jest.fn()
  }
}));

describe("SelfIntersectionValidator", () => {
  let validator: SelfIntersectionValidator;
  let mockCheckIsSimple: jest.MockedFunction<typeof PolygonGeometry.checkIsSimple>;
  let mockCheckIsSimpleBatch: jest.MockedFunction<typeof PolygonGeometry.checkIsSimpleBatch>;

  beforeEach(async () => {
    mockCheckIsSimple = PolygonGeometry.checkIsSimple as jest.MockedFunction<typeof PolygonGeometry.checkIsSimple>;
    mockCheckIsSimpleBatch = PolygonGeometry.checkIsSimpleBatch as jest.MockedFunction<
      typeof PolygonGeometry.checkIsSimpleBatch
    >;

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
      mockCheckIsSimple.mockResolvedValue(true);

      const result = await validator.validatePolygon(polygonUuid);

      expect(result).toEqual({
        valid: true,
        extraInfo: null
      });
      expect(mockCheckIsSimple).toHaveBeenCalledWith(polygonUuid);
    });

    it("should return valid=false for self-intersecting polygon", async () => {
      const polygonUuid = "test-uuid-2";
      mockCheckIsSimple.mockResolvedValue(false);

      const result = await validator.validatePolygon(polygonUuid);

      expect(result).toEqual({
        valid: false,
        extraInfo: null
      });
      expect(mockCheckIsSimple).toHaveBeenCalledWith(polygonUuid);
    });

    it("should throw error when polygon is not found (undefined response)", async () => {
      const polygonUuid = "non-existent-uuid";
      const { NotFoundException } = await import("@nestjs/common");
      mockCheckIsSimple.mockResolvedValue(undefined);

      await expect(validator.validatePolygon(polygonUuid)).rejects.toThrow(
        new NotFoundException(`Polygon with UUID ${polygonUuid} not found`)
      );
    });

    it("should throw error when polygon is not found (rejected promise)", async () => {
      const polygonUuid = "non-existent-uuid";
      const { NotFoundException } = await import("@nestjs/common");
      mockCheckIsSimple.mockRejectedValue(new NotFoundException());

      await expect(validator.validatePolygon(polygonUuid)).rejects.toThrow(NotFoundException);
    });

    it("should throw error when sequelize connection is missing", async () => {
      const polygonUuid = "test-uuid";
      const { InternalServerErrorException } = await import("@nestjs/common");
      mockCheckIsSimple.mockRejectedValue(
        new InternalServerErrorException("PolygonGeometry model is missing sequelize connection")
      );

      await expect(validator.validatePolygon(polygonUuid)).rejects.toThrow(InternalServerErrorException);
    });

    it("should handle database query errors", async () => {
      const polygonUuid = "test-uuid";
      const dbError = new Error("Database connection failed");
      mockCheckIsSimple.mockRejectedValue(dbError);

      await expect(validator.validatePolygon(polygonUuid)).rejects.toThrow(dbError);
    });
  });

  describe("validatePolygons", () => {
    it("should validate multiple polygons successfully", async () => {
      const polygonUuids = ["uuid-1", "uuid-2", "uuid-3"];
      const mockResults = [
        { uuid: "uuid-1", isSimple: true },
        { uuid: "uuid-2", isSimple: false },
        { uuid: "uuid-3", isSimple: true }
      ];
      mockCheckIsSimpleBatch.mockResolvedValue(mockResults);

      const result = await validator.validatePolygons(polygonUuids);

      expect(result).toEqual([
        { polygonUuid: "uuid-1", valid: true, extraInfo: null },
        { polygonUuid: "uuid-2", valid: false, extraInfo: null },
        { polygonUuid: "uuid-3", valid: true, extraInfo: null }
      ]);
      expect(mockCheckIsSimpleBatch).toHaveBeenCalledWith(polygonUuids);
    });

    it("should handle missing polygons in results", async () => {
      const polygonUuids = ["uuid-1", "uuid-2", "uuid-3"];
      const mockResults = [
        { uuid: "uuid-1", isSimple: true },
        { uuid: "uuid-3", isSimple: false }
      ];
      mockCheckIsSimpleBatch.mockResolvedValue(mockResults);

      const result = await validator.validatePolygons(polygonUuids);

      expect(result).toEqual([
        { polygonUuid: "uuid-1", valid: true, extraInfo: null },
        { polygonUuid: "uuid-2", valid: false, extraInfo: null },
        { polygonUuid: "uuid-3", valid: false, extraInfo: null }
      ]);
    });

    it("should handle empty polygon list", async () => {
      const polygonUuids: string[] = [];
      mockCheckIsSimpleBatch.mockResolvedValue([]);

      const result = await validator.validatePolygons(polygonUuids);

      expect(result).toEqual([]);
      expect(mockCheckIsSimpleBatch).toHaveBeenCalledWith([]);
    });

    it("should throw error when sequelize connection is missing", async () => {
      const polygonUuids = ["uuid-1"];
      const { InternalServerErrorException } = await import("@nestjs/common");
      mockCheckIsSimpleBatch.mockRejectedValue(
        new InternalServerErrorException("PolygonGeometry model is missing sequelize connection")
      );

      await expect(validator.validatePolygons(polygonUuids)).rejects.toThrow(InternalServerErrorException);
    });

    it("should handle database query errors", async () => {
      const polygonUuids = ["uuid-1"];
      const dbError = new Error("Database connection failed");
      mockCheckIsSimpleBatch.mockRejectedValue(dbError);

      await expect(validator.validatePolygons(polygonUuids)).rejects.toThrow(dbError);
    });
  });
});

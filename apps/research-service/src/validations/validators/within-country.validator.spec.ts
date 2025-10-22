import { Test, TestingModule } from "@nestjs/testing";
import { WithinCountryValidator } from "./within-country.validator";
import { PolygonGeometry } from "@terramatch-microservices/database/entities";
import { InternalServerErrorException } from "@nestjs/common";

interface MockTransaction {
  commit: jest.Mock;
  rollback: jest.Mock;
}

jest.mock("@terramatch-microservices/database/entities", () => ({
  PolygonGeometry: {
    sequelize: {
      transaction: jest.fn()
    },
    checkWithinCountryIntersection: jest.fn()
  }
}));

describe("WithinCountryValidator", () => {
  let validator: WithinCountryValidator;
  let mockTransaction: jest.MockedFunction<(...args: unknown[]) => Promise<unknown>>;
  let mockCheckWithinCountryIntersection: jest.MockedFunction<typeof PolygonGeometry.checkWithinCountryIntersection>;

  const testPolygonUuid = "d2239d63-83ed-4df8-996c-2b79555385f9";

  beforeEach(async () => {
    mockTransaction = PolygonGeometry.sequelize?.transaction as jest.MockedFunction<
      (...args: unknown[]) => Promise<unknown>
    >;
    mockCheckWithinCountryIntersection = PolygonGeometry.checkWithinCountryIntersection as jest.MockedFunction<
      typeof PolygonGeometry.checkWithinCountryIntersection
    >;

    const module: TestingModule = await Test.createTestingModule({
      providers: [WithinCountryValidator]
    }).compile();

    validator = module.get<WithinCountryValidator>(WithinCountryValidator);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("validatePolygon", () => {
    it("should return valid when polygon is 100% within country", async () => {
      const mockTransactionInstance: MockTransaction = {
        commit: jest.fn(),
        rollback: jest.fn()
      };

      const mockResult = {
        polygonArea: 1000,
        intersectionArea: 1000,
        country: "Cambodia"
      };

      mockTransaction.mockResolvedValueOnce(mockTransactionInstance);
      mockCheckWithinCountryIntersection.mockResolvedValueOnce(mockResult);

      const result = await validator.validatePolygon(testPolygonUuid);

      expect(result.valid).toBe(true);
      expect(result.extraInfo).toEqual({
        inside_percentage: 100,
        country_name: "Cambodia"
      });
      expect(mockTransactionInstance.commit).toHaveBeenCalled();
    });

    it("should return valid when polygon is >= 75% within country", async () => {
      const mockTransactionInstance: MockTransaction = {
        commit: jest.fn(),
        rollback: jest.fn()
      };

      const mockResult = {
        polygonArea: 1000,
        intersectionArea: 780,
        country: "Cambodia"
      };

      mockTransaction.mockResolvedValueOnce(mockTransactionInstance);
      mockCheckWithinCountryIntersection.mockResolvedValueOnce(mockResult);

      const result = await validator.validatePolygon(testPolygonUuid);

      expect(result.valid).toBe(true);
      expect(result.extraInfo).toEqual({
        inside_percentage: 78,
        country_name: "Cambodia"
      });
    });

    it("should return invalid when polygon is < 75% within country", async () => {
      const mockTransactionInstance: MockTransaction = {
        commit: jest.fn(),
        rollback: jest.fn()
      };

      const mockResult = {
        polygonArea: 1000,
        intersectionArea: 508.4,
        country: "Cambodia"
      };

      mockTransaction.mockResolvedValueOnce(mockTransactionInstance);
      mockCheckWithinCountryIntersection.mockResolvedValueOnce(mockResult);

      const result = await validator.validatePolygon(testPolygonUuid);

      expect(result.valid).toBe(false);
      expect(result.extraInfo).toEqual({
        inside_percentage: 50.84,
        country_name: "Cambodia"
      });
    });

    it("should throw NotFoundException when polygon not found", async () => {
      const mockTransactionInstance: MockTransaction = {
        commit: jest.fn(),
        rollback: jest.fn()
      };

      mockTransaction.mockResolvedValue(mockTransactionInstance);
      mockCheckWithinCountryIntersection.mockResolvedValue(null);

      await expect(validator.validatePolygon(testPolygonUuid)).rejects.toThrow(
        `Polygon with UUID ${testPolygonUuid} not found or has no associated project`
      );

      expect(mockTransactionInstance.commit).toHaveBeenCalled();
      expect(mockTransactionInstance.rollback).not.toHaveBeenCalled();
    });

    it("should handle database errors gracefully and rollback transaction", async () => {
      const mockTransactionInstance: MockTransaction = {
        commit: jest.fn(),
        rollback: jest.fn()
      };

      mockTransaction.mockResolvedValueOnce(mockTransactionInstance);
      mockCheckWithinCountryIntersection.mockRejectedValueOnce(new Error("Database error"));

      await expect(validator.validatePolygon(testPolygonUuid)).rejects.toThrow("Database error");
      expect(mockTransactionInstance.rollback).toHaveBeenCalled();
      expect(mockTransactionInstance.commit).not.toHaveBeenCalled();
    });

    it("should throw InternalServerErrorException when sequelize is not available", async () => {
      const originalSequelize = PolygonGeometry.sequelize;
      (PolygonGeometry as unknown as { sequelize: null }).sequelize = null;

      await expect(validator.validatePolygon(testPolygonUuid)).rejects.toThrow(InternalServerErrorException);
      await expect(validator.validatePolygon(testPolygonUuid)).rejects.toThrow(
        "PolygonGeometry model is missing sequelize connection"
      );

      (PolygonGeometry as unknown as { sequelize: typeof originalSequelize }).sequelize = originalSequelize;
    });

    it("should round percentage to 2 decimal places", async () => {
      const mockTransactionInstance: MockTransaction = {
        commit: jest.fn(),
        rollback: jest.fn()
      };

      const mockResult = {
        polygonArea: 1000,
        intersectionArea: 831.234567,
        country: "Cambodia"
      };

      mockTransaction.mockResolvedValueOnce(mockTransactionInstance);
      mockCheckWithinCountryIntersection.mockResolvedValueOnce(mockResult);

      const result = await validator.validatePolygon(testPolygonUuid);

      expect(result.valid).toBe(true);
      expect(result.extraInfo?.inside_percentage).toBe(83.12);
    });

    it("should handle exactly 75% threshold correctly", async () => {
      const mockTransactionInstance: MockTransaction = {
        commit: jest.fn(),
        rollback: jest.fn()
      };

      const mockResult = {
        polygonArea: 1000,
        intersectionArea: 750,
        country: "Cambodia"
      };

      mockTransaction.mockResolvedValueOnce(mockTransactionInstance);
      mockCheckWithinCountryIntersection.mockResolvedValueOnce(mockResult);

      const result = await validator.validatePolygon(testPolygonUuid);

      expect(result.valid).toBe(true);
      expect(result.extraInfo?.inside_percentage).toBe(75);
    });

    it("should handle different country names correctly", async () => {
      const mockTransactionInstance: MockTransaction = {
        commit: jest.fn(),
        rollback: jest.fn()
      };

      const mockResult = {
        polygonArea: 1000,
        intersectionArea: 800,
        country: "Australia"
      };

      mockTransaction.mockResolvedValueOnce(mockTransactionInstance);
      mockCheckWithinCountryIntersection.mockResolvedValueOnce(mockResult);

      const result = await validator.validatePolygon(testPolygonUuid);

      expect(result.valid).toBe(true);
      expect(result.extraInfo?.country_name).toBe("Australia");
    });
  });

  describe("getIntersectionData", () => {
    it("should use READ_COMMITTED isolation level for transaction", async () => {
      const mockTransactionInstance: MockTransaction = {
        commit: jest.fn(),
        rollback: jest.fn()
      };

      const mockResult = {
        polygonArea: 1000,
        intersectionArea: 800,
        country: "Cambodia"
      };

      mockTransaction.mockResolvedValueOnce(mockTransactionInstance);
      mockCheckWithinCountryIntersection.mockResolvedValueOnce(mockResult);

      await validator.validatePolygon(testPolygonUuid);

      expect(mockTransaction).toHaveBeenCalledWith({
        isolationLevel: expect.any(String)
      });
    });
  });

  describe("validatePolygons", () => {
    it("should return empty array for empty input", async () => {
      const result = await validator.validatePolygons([]);
      expect(result).toEqual([]);
    });

    it("should validate multiple polygons in batch", async () => {
      const testPolygonUuid2 = "e3349d63-83ed-4df8-996c-2b79555385fa";
      const mockTransactionInstance: MockTransaction = {
        commit: jest.fn(),
        rollback: jest.fn()
      };

      const mockResults = [
        { polygonUuid: testPolygonUuid, polygonArea: 1000, intersectionArea: 800, country: "Cambodia" },
        { polygonUuid: testPolygonUuid2, polygonArea: 1000, intersectionArea: 900, country: "Cambodia" }
      ];

      (
        PolygonGeometry as unknown as { checkWithinCountryIntersectionBatch: jest.Mock }
      ).checkWithinCountryIntersectionBatch = jest.fn();
      mockTransaction.mockResolvedValueOnce(mockTransactionInstance);
      (PolygonGeometry.checkWithinCountryIntersectionBatch as jest.Mock).mockResolvedValueOnce(mockResults);

      const result = await validator.validatePolygons([testPolygonUuid, testPolygonUuid2]);

      expect(result).toHaveLength(2);
      expect(result[0].polygonUuid).toBe(testPolygonUuid);
      expect(result[0].valid).toBe(true);
      expect(result[1].polygonUuid).toBe(testPolygonUuid2);
      expect(result[1].valid).toBe(true);
    });

    it("should handle polygon not found in batch", async () => {
      const mockTransactionInstance: MockTransaction = {
        commit: jest.fn(),
        rollback: jest.fn()
      };

      (
        PolygonGeometry as unknown as { checkWithinCountryIntersectionBatch: jest.Mock }
      ).checkWithinCountryIntersectionBatch = jest.fn();
      mockTransaction.mockResolvedValueOnce(mockTransactionInstance);
      (PolygonGeometry.checkWithinCountryIntersectionBatch as jest.Mock).mockResolvedValueOnce([]);

      const result = await validator.validatePolygons([testPolygonUuid]);

      expect(result).toHaveLength(1);
      expect(result[0].valid).toBe(false);
    });

    it("should throw InternalServerErrorException when sequelize is not available in batch", async () => {
      const originalSequelize = PolygonGeometry.sequelize;
      (PolygonGeometry as unknown as { sequelize: null }).sequelize = null;

      await expect(validator.validatePolygons([testPolygonUuid])).rejects.toThrow(InternalServerErrorException);

      (PolygonGeometry as unknown as { sequelize: typeof originalSequelize }).sequelize = originalSequelize;
    });

    it("should handle database errors gracefully in batch", async () => {
      const mockTransactionInstance: MockTransaction = {
        commit: jest.fn(),
        rollback: jest.fn()
      };

      (
        PolygonGeometry as unknown as { checkWithinCountryIntersectionBatch: jest.Mock }
      ).checkWithinCountryIntersectionBatch = jest.fn();
      mockTransaction.mockResolvedValueOnce(mockTransactionInstance);
      (PolygonGeometry.checkWithinCountryIntersectionBatch as jest.Mock).mockRejectedValueOnce(
        new Error("Database error")
      );

      await expect(validator.validatePolygons([testPolygonUuid])).rejects.toThrow("Database error");
      expect(mockTransactionInstance.rollback).toHaveBeenCalled();
    });
  });
});

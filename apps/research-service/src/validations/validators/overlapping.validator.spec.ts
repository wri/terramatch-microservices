import { Test, TestingModule } from "@nestjs/testing";
import { OverlappingValidator } from "./overlapping.validator";
import { SitePolygon, PolygonGeometry } from "@terramatch-microservices/database/entities";
import { NotFoundException, InternalServerErrorException } from "@nestjs/common";

interface MockTransaction {
  commit: jest.Mock;
  rollback: jest.Mock;
}

jest.mock("@terramatch-microservices/database/entities", () => ({
  SitePolygon: {
    findOne: jest.fn(),
    findAll: jest.fn()
  },
  Site: {
    findByPk: jest.fn()
  },
  PolygonGeometry: {
    sequelize: {
      query: jest.fn(),
      transaction: jest.fn()
    }
  }
}));

describe("OverlappingValidator", () => {
  let validator: OverlappingValidator;
  let mockSitePolygonFindOne: jest.MockedFunction<typeof SitePolygon.findOne>;
  let mockSitePolygonFindAll: jest.MockedFunction<typeof SitePolygon.findAll>;
  let mockPolygonGeometryQuery: jest.MockedFunction<(...args: unknown[]) => Promise<unknown>>;
  let mockTransaction: jest.MockedFunction<(...args: unknown[]) => Promise<unknown>>;

  const testUuids = {
    polygon1: "d2239d63-83ed-4df8-996c-2b79555385f9",
    polygon2: "0aacf213-2cf3-45e3-be12-3a28580b2a06",
    polygon3: "695caaa6-aae0-4d6a-b362-c13dcd7dc8b9"
  };

  const testSiteUuid = "a4fdb842-da5e-45a8-a681-d29d9fef0af2";
  const testProjectId = 123;

  beforeEach(async () => {
    mockSitePolygonFindOne = SitePolygon.findOne as jest.MockedFunction<typeof SitePolygon.findOne>;
    mockSitePolygonFindAll = SitePolygon.findAll as jest.MockedFunction<typeof SitePolygon.findAll>;
    mockPolygonGeometryQuery = PolygonGeometry.sequelize?.query as jest.MockedFunction<
      (...args: unknown[]) => Promise<unknown>
    >;
    mockTransaction = PolygonGeometry.sequelize?.transaction as jest.MockedFunction<
      (...args: unknown[]) => Promise<unknown>
    >;

    const module: TestingModule = await Test.createTestingModule({
      providers: [OverlappingValidator]
    }).compile();

    validator = module.get<OverlappingValidator>(OverlappingValidator);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.resetAllMocks();
  });

  describe("validatePolygon", () => {
    it("should return valid when polygon has no overlaps", async () => {
      const mockSitePolygon = {
        polygonUuid: testUuids.polygon1,
        siteUuid: testSiteUuid,
        site: {
          projectId: testProjectId
        }
      };

      const mockRelatedSitePolygons = [];

      mockSitePolygonFindOne.mockResolvedValueOnce(mockSitePolygon as unknown as SitePolygon);
      mockSitePolygonFindAll.mockResolvedValueOnce(mockRelatedSitePolygons as unknown as SitePolygon[]);

      const result = await validator.validatePolygon(testUuids.polygon1);

      expect(result.valid).toBe(true);
      expect(result.extraInfo).toBeNull();
    });

    it("should return valid with null extraInfo when no overlaps found", async () => {
      const mockSitePolygon = {
        polygonUuid: testUuids.polygon1,
        siteUuid: testSiteUuid,
        site: {
          projectId: testProjectId
        }
      };

      const mockRelatedSitePolygons = [{ polygonUuid: testUuids.polygon2 }];

      const mockTransactionInstance: MockTransaction = {
        commit: jest.fn(),
        rollback: jest.fn()
      };

      mockSitePolygonFindOne.mockResolvedValueOnce(mockSitePolygon as unknown as SitePolygon);
      mockSitePolygonFindAll.mockResolvedValueOnce(mockRelatedSitePolygons as unknown as SitePolygon[]);
      mockTransaction.mockResolvedValueOnce(mockTransactionInstance);
      mockPolygonGeometryQuery.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

      const result = await validator.validatePolygon(testUuids.polygon1);

      expect(result.valid).toBe(true);
      expect(result.extraInfo).toBeNull();
    });

    it("should return invalid when polygon has overlaps", async () => {
      const mockSitePolygon = {
        polygonUuid: testUuids.polygon1,
        siteUuid: testSiteUuid,
        site: {
          projectId: testProjectId
        }
      };

      const mockRelatedSitePolygons = [{ polygonUuid: testUuids.polygon2 }, { polygonUuid: testUuids.polygon3 }];

      const mockBboxResults = [
        { targetUuid: testUuids.polygon1, candidateUuid: testUuids.polygon2 },
        { targetUuid: testUuids.polygon1, candidateUuid: testUuids.polygon3 }
      ];

      const mockIntersectionResults = [
        {
          targetUuid: testUuids.polygon1,
          candidateUuid: testUuids.polygon2,
          candidateName: "A",
          siteName: "CAPULIN VMRL CAFE CAPITAN",
          targetArea: 1000,
          candidateArea: 800,
          intersectionArea: 1.4,
          intersectionLatitude: 35.0
        },
        {
          targetUuid: testUuids.polygon1,
          candidateUuid: testUuids.polygon3,
          candidateName: "B",
          siteName: "CAPULIN VMRL CAFE CAPITAN",
          targetArea: 1000,
          candidateArea: 1200,
          intersectionArea: 0.9,
          intersectionLatitude: 35.0
        }
      ];

      const mockTransactionInstance = {
        commit: jest.fn(),
        rollback: jest.fn()
      };

      jest.clearAllMocks();
      mockSitePolygonFindOne.mockResolvedValueOnce(mockSitePolygon as unknown as SitePolygon);
      mockSitePolygonFindAll.mockResolvedValueOnce(mockRelatedSitePolygons as unknown as SitePolygon[]);
      mockTransaction.mockResolvedValueOnce(mockTransactionInstance);
      mockPolygonGeometryQuery.mockResolvedValueOnce(mockBboxResults).mockResolvedValueOnce(mockIntersectionResults);

      const result = await validator.validatePolygon(testUuids.polygon1);

      expect(result.valid).toBe(false);
      expect(result.extraInfo).toHaveLength(2);
      expect(result.extraInfo?.[0]).toMatchObject({
        polyUuid: testUuids.polygon2,
        polyName: "A",
        siteName: "CAPULIN VMRL CAFE CAPITAN",
        percentage: 0.18,
        intersectSmaller: true
      });
      expect(result.extraInfo?.[1]).toMatchObject({
        polyUuid: testUuids.polygon3,
        polyName: "B",
        siteName: "CAPULIN VMRL CAFE CAPITAN",
        percentage: 0.09,
        intersectSmaller: false
      });
    });

    it("should throw NotFoundException when polygon not found", async () => {
      mockSitePolygonFindOne.mockResolvedValueOnce(null);

      await expect(validator.validatePolygon("non-existent-uuid")).rejects.toThrow(NotFoundException);
    });

    it("should throw NotFoundException when polygon has no associated site", async () => {
      const mockSitePolygon = {
        polygonUuid: testUuids.polygon1,
        siteUuid: testSiteUuid,
        site: null
      };

      mockSitePolygonFindOne.mockResolvedValueOnce(mockSitePolygon as unknown as SitePolygon);

      await expect(validator.validatePolygon(testUuids.polygon1)).rejects.toThrow(NotFoundException);
    });

    it("should handle database errors gracefully", async () => {
      const mockSitePolygon = {
        polygonUuid: testUuids.polygon1,
        siteUuid: testSiteUuid,
        site: {
          projectId: testProjectId
        }
      };

      const mockRelatedSitePolygons = [{ polygonUuid: testUuids.polygon2 }];

      const mockTransactionInstance = {
        commit: jest.fn(),
        rollback: jest.fn()
      };

      jest.clearAllMocks();
      mockSitePolygonFindOne.mockResolvedValueOnce(mockSitePolygon as unknown as SitePolygon);
      mockSitePolygonFindAll.mockResolvedValueOnce(mockRelatedSitePolygons as unknown as SitePolygon[]);
      mockTransaction.mockResolvedValueOnce(mockTransactionInstance);
      mockPolygonGeometryQuery.mockRejectedValueOnce(new Error("Database error"));

      await expect(validator.validatePolygon(testUuids.polygon1)).rejects.toThrow("Database error");

      expect(mockTransactionInstance.rollback).toHaveBeenCalled();
    });

    it("should throw InternalServerErrorException when sequelize is not available", async () => {
      const originalSequelize = PolygonGeometry.sequelize;
      (PolygonGeometry as unknown as { sequelize: null }).sequelize = null;

      const mockSitePolygon = {
        polygonUuid: testUuids.polygon1,
        siteUuid: testSiteUuid,
        site: {
          projectId: testProjectId
        }
      };

      const mockRelatedSitePolygons = [{ polygonUuid: testUuids.polygon2 }];

      mockSitePolygonFindOne.mockResolvedValueOnce(mockSitePolygon as unknown as SitePolygon);
      mockSitePolygonFindAll.mockResolvedValueOnce(mockRelatedSitePolygons as unknown as SitePolygon[]);

      await expect(validator.validatePolygon(testUuids.polygon1)).rejects.toThrow(InternalServerErrorException);

      (PolygonGeometry as unknown as { sequelize: typeof originalSequelize }).sequelize = originalSequelize;
    });
  });

  describe("checkIntersections", () => {
    it("should return empty array when targetUuids is empty", async () => {
      const result = await validator["checkIntersections"]([], [testUuids.polygon2]);
      expect(result).toEqual([]);
    });

    it("should return empty array when candidateUuids is empty", async () => {
      const result = await validator["checkIntersections"]([testUuids.polygon1], []);
      expect(result).toEqual([]);
    });

    it("should return empty array when bboxFilteredResults is empty", async () => {
      const mockTransactionInstance: MockTransaction = {
        commit: jest.fn(),
        rollback: jest.fn()
      };

      jest.clearAllMocks();
      mockTransaction.mockResolvedValueOnce(mockTransactionInstance);
      mockPolygonGeometryQuery.mockResolvedValueOnce([]);

      const result = await validator["checkIntersections"]([testUuids.polygon1], [testUuids.polygon2]);

      expect(result).toEqual([]);
      expect(mockTransactionInstance.commit).toHaveBeenCalled();
    });

    it("should handle null candidateName and siteName", async () => {
      const mockTransactionInstance: MockTransaction = {
        commit: jest.fn(),
        rollback: jest.fn()
      };

      const mockBboxResults = [{ targetUuid: testUuids.polygon1, candidateUuid: testUuids.polygon2 }];

      const mockIntersectionResults = [
        {
          targetUuid: testUuids.polygon1,
          candidateUuid: testUuids.polygon2,
          candidateName: null,
          siteName: null,
          targetArea: 1000,
          candidateArea: 800,
          intersectionArea: 1.4,
          intersectionLatitude: 35.0
        }
      ];

      jest.clearAllMocks();
      mockTransaction.mockResolvedValueOnce(mockTransactionInstance);
      mockPolygonGeometryQuery.mockResolvedValueOnce(mockBboxResults).mockResolvedValueOnce(mockIntersectionResults);

      const result = await validator["checkIntersections"]([testUuids.polygon1], [testUuids.polygon2]);

      expect(result).toHaveLength(1);
      expect(result[0].candidateName).toBeNull();
      expect(result[0].siteName).toBeNull();
    });
  });

  describe("Unit Tests with Mocked Geometries", () => {
    it("should detect overlaps with realistic mocked data", async () => {
      const testUuids = {
        polygon1: "d2239d63-83ed-4df8-996c-2b79555385f9",
        polygon2: "0aacf213-2cf3-45e3-be12-3a28580b2a06",
        polygon3: "695caaa6-aae0-4d6a-b362-c13dcd7dc8b9"
      };

      const testSiteUuid = "a4fdb842-da5e-45a8-a681-d29d9fef0af2";
      const testProjectId = 123;

      // Mock the database calls to return realistic data
      const mockSitePolygon = {
        polygonUuid: testUuids.polygon1,
        siteUuid: testSiteUuid,
        site: {
          projectId: testProjectId
        }
      };

      const mockRelatedSitePolygons = [{ polygonUuid: testUuids.polygon2 }, { polygonUuid: testUuids.polygon3 }];

      const mockBboxResults = [
        { targetUuid: testUuids.polygon1, candidateUuid: testUuids.polygon2 },
        { targetUuid: testUuids.polygon1, candidateUuid: testUuids.polygon3 }
      ];

      const mockIntersectionResults = [
        {
          targetUuid: testUuids.polygon1,
          candidateUuid: testUuids.polygon2,
          candidateName: "A",
          siteName: "CAPULIN VMRL CAFE CAPITAN",
          targetArea: 1000,
          candidateArea: 800,
          intersectionArea: 1.4,
          intersectionLatitude: 35.0
        },
        {
          targetUuid: testUuids.polygon1,
          candidateUuid: testUuids.polygon3,
          candidateName: "B",
          siteName: "CAPULIN VMRL CAFE CAPITAN",
          targetArea: 1000,
          candidateArea: 1200,
          intersectionArea: 0.9,
          intersectionLatitude: 35.0
        }
      ];

      const mockTransactionInstance = {
        commit: jest.fn(),
        rollback: jest.fn()
      };

      // Set up mocks
      mockSitePolygonFindOne.mockResolvedValueOnce(mockSitePolygon as unknown as SitePolygon);
      mockSitePolygonFindAll.mockResolvedValueOnce(mockRelatedSitePolygons as unknown as SitePolygon[]);
      mockTransaction.mockResolvedValueOnce(mockTransactionInstance);
      mockPolygonGeometryQuery.mockResolvedValueOnce(mockBboxResults).mockResolvedValueOnce(mockIntersectionResults);

      const result = await validator.validatePolygon(testUuids.polygon1);

      expect(result.valid).toBe(false);
      expect(result.extraInfo).not.toBeNull();
      expect(result.extraInfo).toHaveLength(2);

      const overlapInfo = result.extraInfo;
      if (overlapInfo == null) {
        throw new Error("Expected overlap info to be present");
      }

      const polyUuids = overlapInfo.map(info => info.polyUuid);
      expect(polyUuids).toContain(testUuids.polygon2);
      expect(polyUuids).toContain(testUuids.polygon3);

      overlapInfo.forEach(info => {
        expect(info.percentage).toBeGreaterThan(0);
        expect(info.percentage).toBeLessThan(50);
        expect(info.siteName).toBe("CAPULIN VMRL CAFE CAPITAN");
      });
    });
  });

  describe("buildOverlapInfo", () => {
    it("should calculate percentage correctly for smaller intersecting polygon", () => {
      const intersections = [
        {
          targetUuid: testUuids.polygon1,
          candidateUuid: testUuids.polygon2,
          candidateName: "A",
          siteName: "Test Site",
          targetArea: 1000,
          candidateArea: 500,
          intersectionArea: 50,
          intersectionLatitude: 35.0
        }
      ];

      const result = validator["buildOverlapInfo"](intersections, testUuids.polygon1);

      expect(result).toHaveLength(1);
      expect(result[0].percentage).toBe(10);
      expect(result[0].intersectSmaller).toBe(true);
    });

    it("should calculate percentage correctly for larger intersecting polygon", () => {
      const intersections = [
        {
          targetUuid: testUuids.polygon1,
          candidateUuid: testUuids.polygon2,
          candidateName: "A",
          siteName: "Test Site",
          targetArea: 500,
          candidateArea: 1000,
          intersectionArea: 50,
          intersectionLatitude: 35.0
        }
      ];

      const result = validator["buildOverlapInfo"](intersections, testUuids.polygon1);

      expect(result).toHaveLength(1);
      expect(result[0].percentage).toBe(10);
      expect(result[0].intersectSmaller).toBe(false);
    });

    it("should filter intersections by target UUID", () => {
      const intersections = [
        {
          targetUuid: testUuids.polygon1,
          candidateUuid: testUuids.polygon2,
          candidateName: "A",
          siteName: "Test Site",
          targetArea: 1000,
          candidateArea: 500,
          intersectionArea: 50,
          intersectionLatitude: 35.0
        },
        {
          targetUuid: testUuids.polygon3,
          candidateUuid: testUuids.polygon2,
          candidateName: "A",
          siteName: "Test Site",
          targetArea: 1000,
          candidateArea: 500,
          intersectionArea: 50,
          intersectionLatitude: 35.0
        }
      ];

      const result = validator["buildOverlapInfo"](intersections, testUuids.polygon1);

      expect(result).toHaveLength(1);
      expect(result[0].polyUuid).toBe(testUuids.polygon2);
    });
  });
});

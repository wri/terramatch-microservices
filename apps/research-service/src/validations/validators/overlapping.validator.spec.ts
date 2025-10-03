import { Test, TestingModule } from "@nestjs/testing";
import { OverlappingValidator } from "./overlapping.validator";
import { SitePolygon, PolygonGeometry, Site, Project } from "@terramatch-microservices/database/entities";
import { NotFoundException, InternalServerErrorException } from "@nestjs/common";
import {
  SitePolygonFactory,
  PolygonGeometryFactory,
  SiteFactory,
  ProjectFactory
} from "@terramatch-microservices/database/factories";

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
        { target_uuid: testUuids.polygon1, candidate_uuid: testUuids.polygon2 },
        { target_uuid: testUuids.polygon1, candidate_uuid: testUuids.polygon3 }
      ];

      const mockIntersectionResults = [
        {
          target_uuid: testUuids.polygon1,
          candidate_uuid: testUuids.polygon2,
          candidate_name: "A",
          site_name: "CAPULIN VMRL CAFE CAPITAN",
          target_area: 1000,
          candidate_area: 800,
          intersection_area: 1.4
        },
        {
          target_uuid: testUuids.polygon1,
          candidate_uuid: testUuids.polygon3,
          candidate_name: "B",
          site_name: "CAPULIN VMRL CAFE CAPITAN",
          target_area: 1000,
          candidate_area: 1200,
          intersection_area: 0.9
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
        poly_uuid: testUuids.polygon2,
        poly_name: "A",
        site_name: "CAPULIN VMRL CAFE CAPITAN",
        percentage: 0.18,
        intersectSmaller: true
      });
      expect(result.extraInfo?.[1]).toMatchObject({
        poly_uuid: testUuids.polygon3,
        poly_name: "B",
        site_name: "CAPULIN VMRL CAFE CAPITAN",
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

  describe("validatePolygons", () => {
    it("should validate multiple polygons correctly when they have overlaps with other polygons", async () => {
      const polygonUuids = [testUuids.polygon1, testUuids.polygon2];

      const mockSitePolygons = [
        {
          polygonUuid: testUuids.polygon1,
          site: { projectId: testProjectId }
        },
        {
          polygonUuid: testUuids.polygon2,
          site: { projectId: testProjectId }
        }
      ];

      const mockAllProjectPolygons = [
        { polygonUuid: testUuids.polygon1 },
        { polygonUuid: testUuids.polygon2 },
        { polygonUuid: testUuids.polygon3 }
      ];

      const mockBboxResults = [
        { target_uuid: testUuids.polygon1, candidate_uuid: testUuids.polygon3 },
        { target_uuid: testUuids.polygon2, candidate_uuid: testUuids.polygon3 }
      ];

      const mockIntersectionResults = [
        {
          target_uuid: testUuids.polygon1,
          candidate_uuid: testUuids.polygon3,
          candidate_name: "B",
          site_name: "CAPULIN VMRL CAFE CAPITAN",
          target_area: 1000,
          candidate_area: 1200,
          intersection_area: 0.9
        },
        {
          target_uuid: testUuids.polygon2,
          candidate_uuid: testUuids.polygon3,
          candidate_name: "B",
          site_name: "CAPULIN VMRL CAFE CAPITAN",
          target_area: 800,
          candidate_area: 1200,
          intersection_area: 1.2
        }
      ];

      const mockTransactionInstance = {
        commit: jest.fn(),
        rollback: jest.fn()
      };

      mockSitePolygonFindAll
        .mockResolvedValueOnce(mockSitePolygons as unknown as SitePolygon[])
        .mockResolvedValueOnce(mockAllProjectPolygons as unknown as SitePolygon[]);
      mockTransaction.mockResolvedValueOnce(mockTransactionInstance);
      mockPolygonGeometryQuery.mockResolvedValueOnce(mockBboxResults).mockResolvedValueOnce(mockIntersectionResults);

      const results = await validator.validatePolygons(polygonUuids);

      expect(results).toHaveLength(2);
      expect(results[0].polygonUuid).toBe(testUuids.polygon1);
      expect(results[0].valid).toBe(false);
      expect(results[0].extraInfo).toHaveLength(1);
      expect(results[1].polygonUuid).toBe(testUuids.polygon2);
      expect(results[1].valid).toBe(false);
      expect(results[1].extraInfo).toHaveLength(1);
    });

    it("should handle polygons from different projects", async () => {
      const polygonUuids = [testUuids.polygon1, testUuids.polygon2];

      const mockSitePolygons = [
        {
          polygonUuid: testUuids.polygon1,
          site: { projectId: testProjectId }
        },
        {
          polygonUuid: testUuids.polygon2,
          site: { projectId: testProjectId + 1 }
        }
      ];

      const mockAllProjectPolygons1 = [{ polygonUuid: testUuids.polygon1 }];
      const mockAllProjectPolygons2 = [{ polygonUuid: testUuids.polygon2 }];

      mockSitePolygonFindAll
        .mockResolvedValueOnce(mockSitePolygons as unknown as SitePolygon[])
        .mockResolvedValueOnce(mockAllProjectPolygons1 as unknown as SitePolygon[])
        .mockResolvedValueOnce(mockAllProjectPolygons2 as unknown as SitePolygon[]);

      const results = await validator.validatePolygons(polygonUuids);

      expect(results).toHaveLength(2);
      expect(results[0].valid).toBe(true);
      expect(results[1].valid).toBe(true);
    });

    it("should handle empty polygon list", async () => {
      mockSitePolygonFindAll.mockResolvedValueOnce([]);
      const results = await validator.validatePolygons([]);
      expect(results).toEqual([]);
    });

    it("should handle case when candidateUuids is empty in validatePolygons", async () => {
      const polygonUuids = [testUuids.polygon1, testUuids.polygon2];

      const mockSitePolygons = [
        {
          polygonUuid: testUuids.polygon1,
          site: { projectId: testProjectId }
        },
        {
          polygonUuid: testUuids.polygon2,
          site: { projectId: testProjectId }
        }
      ];

      const mockAllProjectPolygons = [{ polygonUuid: testUuids.polygon1 }, { polygonUuid: testUuids.polygon2 }];

      mockSitePolygonFindAll
        .mockResolvedValueOnce(mockSitePolygons as unknown as SitePolygon[])
        .mockResolvedValueOnce(mockAllProjectPolygons as unknown as SitePolygon[]);

      const results = await validator.validatePolygons(polygonUuids);

      expect(results).toHaveLength(2);
      expect(results[0].valid).toBe(true);
      expect(results[0].extraInfo).toBeNull();
      expect(results[1].valid).toBe(true);
      expect(results[1].extraInfo).toBeNull();
    });

    it("should handle polygons not found in database", async () => {
      const polygonUuids = ["non-existent-1", "non-existent-2"];

      mockSitePolygonFindAll.mockResolvedValueOnce([]);

      const results = await validator.validatePolygons(polygonUuids);

      expect(results).toHaveLength(2);
      expect(results[0].valid).toBe(false);
      expect(results[0].extraInfo).toEqual({ error: "Polygon not found or has no associated project" });
      expect(results[1].valid).toBe(false);
      expect(results[1].extraInfo).toEqual({ error: "Polygon not found or has no associated project" });
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

    it("should handle null candidate_name and site_name", async () => {
      const mockTransactionInstance: MockTransaction = {
        commit: jest.fn(),
        rollback: jest.fn()
      };

      const mockBboxResults = [{ target_uuid: testUuids.polygon1, candidate_uuid: testUuids.polygon2 }];

      const mockIntersectionResults = [
        {
          target_uuid: testUuids.polygon1,
          candidate_uuid: testUuids.polygon2,
          candidate_name: null,
          site_name: null,
          target_area: 1000,
          candidate_area: 800,
          intersection_area: 1.4
        }
      ];

      jest.clearAllMocks();
      mockTransaction.mockResolvedValueOnce(mockTransactionInstance);
      mockPolygonGeometryQuery.mockResolvedValueOnce(mockBboxResults).mockResolvedValueOnce(mockIntersectionResults);

      const result = await validator["checkIntersections"]([testUuids.polygon1], [testUuids.polygon2]);

      expect(result).toHaveLength(1);
      expect(result[0].candidate_name).toBeNull();
      expect(result[0].site_name).toBeNull();
    });
  });

  describe("Integration Tests with Real Geometries", () => {
    let testProject: Project;
    let testSite: Site;
    const testPolygonUuids: string[] = [];

    beforeAll(async () => {
      // Create test project using factory
      testProject = await ProjectFactory.create({
        name: "Test Project for Overlapping Validator"
      });

      // Create test site using factory
      testSite = await SiteFactory.create({
        projectId: testProject.id,
        name: "CAPULIN VMRL CAFE CAPITAN"
      });

      // Create test polygons with real geometries from your example
      const testGeometries = [
        {
          type: "Polygon" as const,
          coordinates: [
            [
              [143.23334803138664, -38.520624013387476],
              [143.23241588768315, -38.52108391858792],
              [143.23224759035406, -38.52019817000951],
              [143.2327841960339, -38.51992980781432],
              [143.23334803138664, -38.520624013387476]
            ]
          ]
        },
        {
          type: "Polygon" as const,
          coordinates: [
            [
              [143.23331767280024, -38.52047557910399],
              [143.2333078408945, -38.52087942596131],
              [143.23437951872864, -38.52094865662333],
              [143.23454666114372, -38.520406347986956],
              [143.23384367981237, -38.519979421293],
              [143.23331767280024, -38.52047557910399]
            ]
          ]
        },
        {
          type: "Polygon" as const,
          coordinates: [
            [
              [143.23268581159294, -38.519941738752955],
              [143.23426288751273, -38.52002249071761],
              [143.23422985974366, -38.51971563277105],
              [143.23273122477292, -38.51971886286175],
              [143.23268581159294, -38.519941738752955]
            ]
          ]
        }
      ];

      const polygonNames = ["14-1 (new)", "A", "B"];

      for (let i = 0; i < testGeometries.length; i++) {
        // Create polygon geometry using factory with custom geometry
        const polygonGeometry = await PolygonGeometryFactory.create({
          polygon: testGeometries[i]
        });

        // Create site polygon using factory
        await SitePolygonFactory.create({
          polygonUuid: polygonGeometry.uuid,
          siteUuid: testSite.uuid,
          polyName: polygonNames[i],
          practice: i === 0 ? "tree-planting" : null,
          plantStart: i === 0 ? new Date("2021-11-11") : null,
          numTrees: i === 0 ? null : 0,
          isActive: true
        });

        testPolygonUuids.push(polygonGeometry.uuid);
      }
    });

    afterAll(async () => {
      // Clean up test data
      if (testPolygonUuids.length > 0) {
        await SitePolygon.destroy({
          where: { polygonUuid: testPolygonUuids }
        });
        await PolygonGeometry.destroy({
          where: { uuid: testPolygonUuids }
        });
      }

      if (testSite != null) {
        await Site.destroy({
          where: { uuid: testSite.uuid }
        });
      }

      if (testProject != null) {
        await Project.destroy({
          where: { id: testProject.id }
        });
      }
    });

    it("should detect real overlaps with actual geometries", async () => {
      const result = await validator.validatePolygon(testPolygonUuids[0]);

      expect(result.valid).toBe(false);
      expect(result.extraInfo).not.toBeNull();
      expect(result.extraInfo).toHaveLength(2);

      const overlapInfo = result.extraInfo;
      if (overlapInfo == null) {
        throw new Error("Expected overlap info to be present");
      }

      const polyUuids = overlapInfo.map(info => info.poly_uuid);
      expect(polyUuids).toContain(testPolygonUuids[1]);
      expect(polyUuids).toContain(testPolygonUuids[2]);

      overlapInfo.forEach(info => {
        expect(info.percentage).toBeGreaterThan(0);
        expect(info.percentage).toBeLessThan(50);
        expect(info.site_name).toBe("CAPULIN VMRL CAFE CAPITAN");
      });
    });
  });

  describe("buildOverlapInfo", () => {
    it("should calculate percentage correctly for smaller intersecting polygon", () => {
      const intersections = [
        {
          target_uuid: testUuids.polygon1,
          candidate_uuid: testUuids.polygon2,
          candidate_name: "A",
          site_name: "Test Site",
          target_area: 1000,
          candidate_area: 500,
          intersection_area: 50
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
          target_uuid: testUuids.polygon1,
          candidate_uuid: testUuids.polygon2,
          candidate_name: "A",
          site_name: "Test Site",
          target_area: 500,
          candidate_area: 1000,
          intersection_area: 50
        }
      ];

      const result = validator["buildOverlapInfo"](intersections, testUuids.polygon1);

      expect(result).toHaveLength(1);
      expect(result[0].percentage).toBe(10);
      expect(result[0].intersectSmaller).toBe(false);
    });

    it("should handle zero area polygons", () => {
      const intersections = [
        {
          target_uuid: testUuids.polygon1,
          candidate_uuid: testUuids.polygon2,
          candidate_name: "A",
          site_name: "Test Site",
          target_area: 0,
          candidate_area: 0,
          intersection_area: 0
        }
      ];

      const result = validator["buildOverlapInfo"](intersections, testUuids.polygon1);

      expect(result).toHaveLength(1);
      expect(result[0].percentage).toBe(100);
    });

    it("should filter intersections by target UUID", () => {
      const intersections = [
        {
          target_uuid: testUuids.polygon1,
          candidate_uuid: testUuids.polygon2,
          candidate_name: "A",
          site_name: "Test Site",
          target_area: 1000,
          candidate_area: 500,
          intersection_area: 50
        },
        {
          target_uuid: testUuids.polygon3,
          candidate_uuid: testUuids.polygon2,
          candidate_name: "A",
          site_name: "Test Site",
          target_area: 1000,
          candidate_area: 500,
          intersection_area: 50
        }
      ];

      const result = validator["buildOverlapInfo"](intersections, testUuids.polygon1);

      expect(result).toHaveLength(1);
      expect(result[0].poly_uuid).toBe(testUuids.polygon2);
    });
  });
});

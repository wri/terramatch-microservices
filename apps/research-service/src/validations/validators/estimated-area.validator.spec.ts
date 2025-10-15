import { Test, TestingModule } from "@nestjs/testing";
import { EstimatedAreaValidator } from "./estimated-area.validator";
import { SitePolygon, Site, Project } from "@terramatch-microservices/database/entities";
import { NotFoundException } from "@nestjs/common";
import { Literal } from "sequelize/types/utils";

jest.mock("@terramatch-microservices/database/entities", () => ({
  SitePolygon: {
    findOne: jest.fn(),
    sum: jest.fn()
  },
  Site: {
    findAll: jest.fn(),
    uuidsSubquery: jest.fn()
  },
  Project: {
    findByPk: jest.fn()
  }
}));

describe("EstimatedAreaValidator", () => {
  let validator: EstimatedAreaValidator;
  let mockSitePolygonFindOne: jest.MockedFunction<typeof SitePolygon.findOne>;
  let mockSitePolygonSum: jest.MockedFunction<typeof SitePolygon.sum>;
  let mockSiteUuidsSubquery: jest.MockedFunction<typeof Site.uuidsSubquery>;
  let mockProjectFindByPk: jest.MockedFunction<typeof Project.findByPk>;

  beforeEach(async () => {
    mockSitePolygonFindOne = SitePolygon.findOne as jest.MockedFunction<typeof SitePolygon.findOne>;
    mockSitePolygonSum = SitePolygon.sum as jest.MockedFunction<typeof SitePolygon.sum>;
    mockSiteUuidsSubquery = Site.uuidsSubquery as jest.MockedFunction<typeof Site.uuidsSubquery>;
    mockProjectFindByPk = Project.findByPk as jest.MockedFunction<typeof Project.findByPk>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [EstimatedAreaValidator]
    }).compile();

    validator = module.get<EstimatedAreaValidator>(EstimatedAreaValidator);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("validatePolygon", () => {
    it("should return valid=true when both site and project areas are within bounds", async () => {
      const polygonUuid = "test-uuid-1";
      const mockSitePolygon = {
        polygonUuid,
        loadSite: jest.fn().mockResolvedValue({
          uuid: "site-uuid-1",
          projectId: 1,
          hectaresToRestoreGoal: 1000
        })
      } as unknown as SitePolygon;

      mockSitePolygonFindOne.mockResolvedValue(mockSitePolygon);
      mockProjectFindByPk.mockResolvedValue({
        id: 1,
        totalHectaresRestoredGoal: 5000
      } as unknown as Project);
      mockSiteUuidsSubquery.mockReturnValue("subquery-literal" as unknown as Literal);
      mockSitePolygonSum
        .mockResolvedValueOnce(800) // Site area sum
        .mockResolvedValueOnce(4000); // Project area sum

      const result = await validator.validatePolygon(polygonUuid);

      expect(result.valid).toBe(true);
      expect(result.extraInfo).toEqual({
        sum_area_site: 800,
        sum_area_project: 4000,
        percentage_site: 80,
        percentage_project: 80,
        total_area_site: 1000,
        total_area_project: 5000
      });
    });

    it("should return valid=false when both site and project areas are outside bounds", async () => {
      const polygonUuid = "test-uuid-2";
      const mockSitePolygon = {
        polygonUuid,
        loadSite: jest.fn().mockResolvedValue({
          uuid: "site-uuid-2",
          projectId: 2,
          hectaresToRestoreGoal: 1000
        })
      } as unknown as SitePolygon;

      mockSitePolygonFindOne.mockResolvedValue(mockSitePolygon);
      mockProjectFindByPk.mockResolvedValue({
        id: 2,
        totalHectaresRestoredGoal: 5000
      } as unknown as Project);
      mockSiteUuidsSubquery.mockReturnValue("subquery-literal" as unknown as Literal);
      mockSitePolygonSum
        .mockResolvedValueOnce(500) // Site area sum - too low
        .mockResolvedValueOnce(2000); // Project area sum - too low

      const result = await validator.validatePolygon(polygonUuid);

      expect(result.valid).toBe(false);
      expect(result.extraInfo).toEqual({
        sum_area_site: 500,
        sum_area_project: 2000,
        percentage_site: 50,
        percentage_project: 40,
        total_area_site: 1000,
        total_area_project: 5000
      });
    });

    it("should return valid=true when only site area is within bounds", async () => {
      const polygonUuid = "test-uuid-3";
      const mockSitePolygon = {
        polygonUuid,
        loadSite: jest.fn().mockResolvedValue({
          uuid: "site-uuid-3",
          projectId: 3,
          hectaresToRestoreGoal: 1000
        })
      } as unknown as SitePolygon;

      mockSitePolygonFindOne.mockResolvedValue(mockSitePolygon);
      mockProjectFindByPk.mockResolvedValue({
        id: 3,
        totalHectaresRestoredGoal: 5000
      } as unknown as Project);
      mockSiteUuidsSubquery.mockReturnValue("subquery-literal" as unknown as Literal);
      mockSitePolygonSum
        .mockResolvedValueOnce(800) // Site area sum - within bounds
        .mockResolvedValueOnce(2000); // Project area sum - outside bounds

      const result = await validator.validatePolygon(polygonUuid);

      expect(result.valid).toBe(true);
    });

    it("should return valid=true when only project area is within bounds", async () => {
      const polygonUuid = "test-uuid-4";
      const mockSitePolygon = {
        polygonUuid,
        loadSite: jest.fn().mockResolvedValue({
          uuid: "site-uuid-4",
          projectId: 4,
          hectaresToRestoreGoal: 1000
        })
      } as unknown as SitePolygon;

      mockSitePolygonFindOne.mockResolvedValue(mockSitePolygon);
      mockProjectFindByPk.mockResolvedValue({
        id: 4,
        totalHectaresRestoredGoal: 5000
      } as unknown as Project);
      mockSiteUuidsSubquery.mockReturnValue("subquery-literal" as unknown as Literal);
      mockSitePolygonSum
        .mockResolvedValueOnce(500) // Site area sum - outside bounds
        .mockResolvedValueOnce(4000); // Project area sum - within bounds

      const result = await validator.validatePolygon(polygonUuid);

      expect(result.valid).toBe(true);
    });

    it("should handle null site hectaresToRestoreGoal", async () => {
      const polygonUuid = "test-uuid-5";
      const mockSitePolygon = {
        polygonUuid,
        loadSite: jest.fn().mockResolvedValue({
          uuid: "site-uuid-5",
          projectId: 5,
          hectaresToRestoreGoal: null
        })
      } as unknown as SitePolygon;

      mockSitePolygonFindOne.mockResolvedValue(mockSitePolygon);
      mockProjectFindByPk.mockResolvedValue({
        id: 5,
        totalHectaresRestoredGoal: 5000
      } as unknown as Project);
      mockSiteUuidsSubquery.mockReturnValue("subquery-literal" as unknown as Literal);
      mockSitePolygonSum.mockResolvedValueOnce(4000); // Project area sum

      const result = await validator.validatePolygon(polygonUuid);

      expect(result.valid).toBe(true); // Only project validation matters
      expect(result.extraInfo?.sum_area_site).toBeNull();
      expect(result.extraInfo?.total_area_site).toBeNull();
    });

    it("should handle null project totalHectaresRestoredGoal", async () => {
      const polygonUuid = "test-uuid-6";
      const mockSitePolygon = {
        polygonUuid,
        loadSite: jest.fn().mockResolvedValue({
          uuid: "site-uuid-6",
          projectId: 6,
          hectaresToRestoreGoal: 1000
        })
      } as unknown as SitePolygon;

      mockSitePolygonFindOne.mockResolvedValue(mockSitePolygon);
      mockProjectFindByPk.mockResolvedValue({
        id: 6,
        totalHectaresRestoredGoal: null
      } as unknown as Project);
      mockSitePolygonSum.mockResolvedValueOnce(800); // Site area sum

      const result = await validator.validatePolygon(polygonUuid);

      expect(result.valid).toBe(true); // Only site validation matters
      expect(result.extraInfo?.sum_area_project).toBeNull();
      expect(result.extraInfo?.total_area_project).toBeNull();
    });

    it("should throw NotFoundException when site polygon is not found", async () => {
      const polygonUuid = "non-existent-uuid";
      mockSitePolygonFindOne.mockResolvedValue(null);

      await expect(validator.validatePolygon(polygonUuid)).rejects.toThrow(
        new NotFoundException(`Site polygon not found for polygon UUID ${polygonUuid}`)
      );
    });

    it("should handle zero hectaresToRestoreGoal", async () => {
      const polygonUuid = "test-uuid-7";
      const mockSitePolygon = {
        polygonUuid,
        loadSite: jest.fn().mockResolvedValue({
          uuid: "site-uuid-7",
          projectId: 7,
          hectaresToRestoreGoal: 0
        })
      } as unknown as SitePolygon;

      mockSitePolygonFindOne.mockResolvedValue(mockSitePolygon);
      mockProjectFindByPk.mockResolvedValue({
        id: 7,
        totalHectaresRestoredGoal: 5000
      } as unknown as Project);
      mockSiteUuidsSubquery.mockReturnValue("subquery-literal" as unknown as Literal);
      mockSitePolygonSum.mockResolvedValueOnce(4000); // Project area sum

      const result = await validator.validatePolygon(polygonUuid);

      expect(result.valid).toBe(true); // Only project validation matters
      expect(result.extraInfo?.sum_area_site).toBeNull();
      expect(result.extraInfo?.total_area_site).toBe(0);
    });

    it("should handle zero totalHectaresRestoredGoal", async () => {
      const polygonUuid = "test-uuid-8";
      const mockSitePolygon = {
        polygonUuid,
        loadSite: jest.fn().mockResolvedValue({
          uuid: "site-uuid-8",
          projectId: 8,
          hectaresToRestoreGoal: 1000
        })
      } as unknown as SitePolygon;

      mockSitePolygonFindOne.mockResolvedValue(mockSitePolygon);
      mockProjectFindByPk.mockResolvedValue({
        id: 8,
        totalHectaresRestoredGoal: 0
      } as unknown as Project);
      mockSitePolygonSum.mockResolvedValueOnce(800); // Site area sum

      const result = await validator.validatePolygon(polygonUuid);

      expect(result.valid).toBe(true); // Only site validation matters
      expect(result.extraInfo?.sum_area_project).toBeNull();
      expect(result.extraInfo?.total_area_project).toBe(0);
    });
  });

  describe("validatePolygons", () => {
    it("should validate multiple polygons successfully", async () => {
      const polygonUuids = ["uuid-1", "uuid-2"];
      const mockSitePolygon1 = {
        polygonUuid: "uuid-1",
        loadSite: jest.fn().mockResolvedValue({
          uuid: "site-uuid-1",
          projectId: 1,
          hectaresToRestoreGoal: 1000
        })
      } as unknown as SitePolygon;

      const mockSitePolygon2 = {
        polygonUuid: "uuid-2",
        loadSite: jest.fn().mockResolvedValue({
          uuid: "site-uuid-2",
          projectId: 2,
          hectaresToRestoreGoal: 2000
        })
      } as unknown as SitePolygon;

      mockSitePolygonFindOne.mockResolvedValueOnce(mockSitePolygon1).mockResolvedValueOnce(mockSitePolygon2);

      mockProjectFindByPk
        .mockResolvedValueOnce({
          id: 1,
          totalHectaresRestoredGoal: 5000
        } as unknown as Project)
        .mockResolvedValueOnce({
          id: 2,
          totalHectaresRestoredGoal: 10000
        } as unknown as Project);

      mockSiteUuidsSubquery
        .mockReturnValueOnce("subquery-literal-1" as unknown as Literal)
        .mockReturnValueOnce("subquery-literal-2" as unknown as Literal);

      mockSitePolygonSum
        .mockResolvedValueOnce(800) // Site area sum for uuid-1
        .mockResolvedValueOnce(4000) // Project area sum for uuid-1
        .mockResolvedValueOnce(1500) // Site area sum for uuid-2
        .mockResolvedValueOnce(8000); // Project area sum for uuid-2

      const result = await validator.validatePolygons(polygonUuids);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        polygonUuid: "uuid-1",
        valid: true,
        extraInfo: expect.objectContaining({
          sum_area_site: 800,
          sum_area_project: 4000
        })
      });
      expect(result[1]).toEqual({
        polygonUuid: "uuid-2",
        valid: true,
        extraInfo: expect.objectContaining({
          sum_area_site: 1500,
          sum_area_project: 8000
        })
      });
    });

    it("should handle errors gracefully for individual polygons", async () => {
      const polygonUuids = ["uuid-1", "uuid-2"];
      const mockSitePolygon = {
        polygonUuid: "uuid-1",
        loadSite: jest.fn().mockResolvedValue({
          uuid: "site-uuid-1",
          projectId: 1,
          hectaresToRestoreGoal: 1000
        })
      } as unknown as SitePolygon;

      mockSitePolygonFindOne.mockResolvedValueOnce(mockSitePolygon).mockResolvedValueOnce(null); // Second polygon not found

      mockProjectFindByPk.mockResolvedValueOnce({
        id: 1,
        totalHectaresRestoredGoal: 5000
      } as unknown as Project);

      mockSiteUuidsSubquery.mockReturnValueOnce("subquery-literal" as unknown as Literal);

      mockSitePolygonSum
        .mockResolvedValueOnce(800) // Site area sum for uuid-1
        .mockResolvedValueOnce(4000); // Project area sum for uuid-1

      const result = await validator.validatePolygons(polygonUuids);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        polygonUuid: "uuid-1",
        valid: true,
        extraInfo: expect.objectContaining({
          sum_area_site: 800,
          sum_area_project: 4000
        })
      });
      expect(result[1]).toEqual({
        polygonUuid: "uuid-2",
        valid: false,
        extraInfo: { error: "Site polygon not found for polygon UUID uuid-2" }
      });
    });

    it("should handle empty polygon list", async () => {
      const result = await validator.validatePolygons([]);
      expect(result).toEqual([]);
    });
  });
});

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
        siteUuid: "site-uuid-1",
        status: "approved",
        calcArea: 100,
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
        polygonStatus: "approved",
        polygonArea: 100,
        isPolygonApproved: true,
        sumAreaSiteApproved: 800,
        sumAreaProjectApproved: 4000,
        percentageSiteApproved: 80,
        percentageProjectApproved: 80,
        totalAreaSite: 1000,
        totalAreaProject: 5000
      });
    });

    it("should return valid=false when both site and project areas are outside bounds", async () => {
      const polygonUuid = "test-uuid-2";
      const mockSitePolygon = {
        polygonUuid,
        siteUuid: "site-uuid-2",
        status: "approved",
        calcArea: 50,
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
        polygonStatus: "approved",
        polygonArea: 50,
        isPolygonApproved: true,
        sumAreaSiteApproved: 500,
        sumAreaProjectApproved: 2000,
        percentageSiteApproved: 50,
        percentageProjectApproved: 40,
        totalAreaSite: 1000,
        totalAreaProject: 5000
      });
    });

    it("should return valid=true when only site area is within bounds", async () => {
      const polygonUuid = "test-uuid-3";
      const mockSitePolygon = {
        polygonUuid,
        siteUuid: "site-uuid-3",
        status: "approved",
        calcArea: 80,
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
        siteUuid: "site-uuid-4",
        status: "approved",
        calcArea: 50,
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
        siteUuid: "site-uuid-5",
        status: "approved",
        calcArea: 100,
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
      expect(result.extraInfo?.sumAreaSiteApproved).toBeNull();
      expect(result.extraInfo?.totalAreaSite).toBeNull();
    });

    it("should handle null project totalHectaresRestoredGoal", async () => {
      const polygonUuid = "test-uuid-6";
      const mockSitePolygon = {
        polygonUuid,
        siteUuid: "site-uuid-6",
        status: "approved",
        calcArea: 80,
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
      expect(result.extraInfo?.sumAreaProjectApproved).toBeNull();
      expect(result.extraInfo?.totalAreaProject).toBeNull();
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
        siteUuid: "site-uuid-7",
        status: "approved",
        calcArea: 100,
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
      expect(result.extraInfo?.sumAreaSiteApproved).toBeNull();
      expect(result.extraInfo?.totalAreaSite).toBe(0);
    });

    it("should handle zero totalHectaresRestoredGoal", async () => {
      const polygonUuid = "test-uuid-8";
      const mockSitePolygon = {
        polygonUuid,
        siteUuid: "site-uuid-8",
        status: "approved",
        calcArea: 80,
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
      expect(result.extraInfo?.sumAreaProjectApproved).toBeNull();
      expect(result.extraInfo?.totalAreaProject).toBe(0);
    });

    it("should calculate projected values for unapproved polygon (draft status)", async () => {
      const polygonUuid = "test-uuid-draft";
      const mockSitePolygon = {
        polygonUuid,
        siteUuid: "site-uuid-draft",
        status: "draft",
        calcArea: 100,
        loadSite: jest.fn().mockResolvedValue({
          uuid: "site-uuid-draft",
          projectId: 10,
          hectaresToRestoreGoal: 1000
        })
      } as unknown as SitePolygon;

      mockSitePolygonFindOne.mockResolvedValue(mockSitePolygon);
      mockProjectFindByPk.mockResolvedValue({
        id: 10,
        totalHectaresRestoredGoal: 5000
      } as unknown as Project);
      mockSiteUuidsSubquery.mockReturnValue("subquery-literal" as unknown as Literal);
      mockSitePolygonSum
        .mockResolvedValueOnce(800) // Site area sum (approved only)
        .mockResolvedValueOnce(4000); // Project area sum (approved only)

      const result = await validator.validatePolygon(polygonUuid);

      expect(result.valid).toBe(true);
      expect(result.extraInfo).toEqual({
        polygonStatus: "draft",
        polygonArea: 100,
        isPolygonApproved: false,
        sumAreaSiteApproved: 800,
        sumAreaProjectApproved: 4000,
        percentageSiteApproved: 80,
        percentageProjectApproved: 80,
        totalAreaSite: 1000,
        totalAreaProject: 5000,
        projectedSumAreaSite: 900,
        projectedPercentageSite: 90,
        projectedSumAreaProject: 4100,
        projectedPercentageProject: 82
      });
    });

    it("should calculate projected values for unapproved polygon (submitted status)", async () => {
      const polygonUuid = "test-uuid-submitted";
      const mockSitePolygon = {
        polygonUuid,
        siteUuid: "site-uuid-submitted",
        status: "pending-approval",
        calcArea: 250,
        loadSite: jest.fn().mockResolvedValue({
          uuid: "site-uuid-submitted",
          projectId: 11,
          hectaresToRestoreGoal: 2000
        })
      } as unknown as SitePolygon;

      mockSitePolygonFindOne.mockResolvedValue(mockSitePolygon);
      mockProjectFindByPk.mockResolvedValue({
        id: 11,
        totalHectaresRestoredGoal: 10000
      } as unknown as Project);
      mockSiteUuidsSubquery.mockReturnValue("subquery-literal" as unknown as Literal);
      mockSitePolygonSum
        .mockResolvedValueOnce(1500) // Site area sum (approved only)
        .mockResolvedValueOnce(7500); // Project area sum (approved only)

      const result = await validator.validatePolygon(polygonUuid);

      expect(result.valid).toBe(true);
      expect(result.extraInfo).toEqual({
        polygonStatus: "pending-approval",
        polygonArea: 250,
        isPolygonApproved: false,
        sumAreaSiteApproved: 1500,
        sumAreaProjectApproved: 7500,
        percentageSiteApproved: 75,
        percentageProjectApproved: 75,
        totalAreaSite: 2000,
        totalAreaProject: 10000,
        projectedSumAreaSite: 1750,
        projectedPercentageSite: 87.5,
        projectedSumAreaProject: 7750,
        projectedPercentageProject: 77.5
      });
    });

    it("should not include projected values for unapproved polygon with zero area", async () => {
      const polygonUuid = "test-uuid-zero-area";
      const mockSitePolygon = {
        polygonUuid,
        siteUuid: "site-uuid-zero",
        status: "draft",
        calcArea: 0,
        loadSite: jest.fn().mockResolvedValue({
          uuid: "site-uuid-zero",
          projectId: 12,
          hectaresToRestoreGoal: 1000
        })
      } as unknown as SitePolygon;

      mockSitePolygonFindOne.mockResolvedValue(mockSitePolygon);
      mockProjectFindByPk.mockResolvedValue({
        id: 12,
        totalHectaresRestoredGoal: 5000
      } as unknown as Project);
      mockSiteUuidsSubquery.mockReturnValue("subquery-literal" as unknown as Literal);
      mockSitePolygonSum
        .mockResolvedValueOnce(800) // Site area sum (approved only)
        .mockResolvedValueOnce(4000); // Project area sum (approved only)

      const result = await validator.validatePolygon(polygonUuid);

      expect(result.extraInfo?.projectedSumAreaSite).toBeUndefined();
      expect(result.extraInfo?.projectedPercentageSite).toBeUndefined();
      expect(result.extraInfo?.projectedSumAreaProject).toBeUndefined();
      expect(result.extraInfo?.projectedPercentageProject).toBeUndefined();
    });

    it("should show projection would push validation outside acceptable range", async () => {
      const polygonUuid = "test-uuid-over-limit";
      const mockSitePolygon = {
        polygonUuid,
        siteUuid: "site-uuid-over",
        status: "draft",
        calcArea: 500,
        loadSite: jest.fn().mockResolvedValue({
          uuid: "site-uuid-over",
          projectId: 13,
          hectaresToRestoreGoal: 1000
        })
      } as unknown as SitePolygon;

      mockSitePolygonFindOne.mockResolvedValue(mockSitePolygon);
      mockProjectFindByPk.mockResolvedValue({
        id: 13,
        totalHectaresRestoredGoal: 5000
      } as unknown as Project);
      mockSiteUuidsSubquery.mockReturnValue("subquery-literal" as unknown as Literal);
      mockSitePolygonSum
        .mockResolvedValueOnce(900) // Site area sum (approved only) - 90%, within bounds
        .mockResolvedValueOnce(6000); // Project area sum (approved only) - 120%, within bounds (75-125%)

      const result = await validator.validatePolygon(polygonUuid);

      expect(result.valid).toBe(true);
      expect(result.extraInfo).toEqual({
        polygonStatus: "draft",
        polygonArea: 500,
        isPolygonApproved: false,
        sumAreaSiteApproved: 900,
        sumAreaProjectApproved: 6000,
        percentageSiteApproved: 90,
        percentageProjectApproved: 120,
        totalAreaSite: 1000,
        totalAreaProject: 5000,
        projectedSumAreaSite: 1400, // Would be 140% - way over limit
        projectedPercentageSite: 140,
        projectedSumAreaProject: 6500, // Would be 130% - over limit
        projectedPercentageProject: 130
      });
    });
  });

  describe("validatePolygons", () => {
    it("should validate multiple polygons successfully", async () => {
      const polygonUuids = ["uuid-1", "uuid-2"];
      const mockSitePolygon1 = {
        polygonUuid: "uuid-1",
        siteUuid: "site-uuid-1",
        status: "approved",
        calcArea: 80,
        loadSite: jest.fn().mockResolvedValue({
          uuid: "site-uuid-1",
          projectId: 1,
          hectaresToRestoreGoal: 1000
        })
      } as unknown as SitePolygon;

      const mockSitePolygon2 = {
        polygonUuid: "uuid-2",
        siteUuid: "site-uuid-2",
        status: "approved",
        calcArea: 150,
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
          sumAreaSiteApproved: 800,
          sumAreaProjectApproved: 4000
        })
      });
      expect(result[1]).toEqual({
        polygonUuid: "uuid-2",
        valid: true,
        extraInfo: expect.objectContaining({
          sumAreaSiteApproved: 1500,
          sumAreaProjectApproved: 8000
        })
      });
    });

    it("should handle errors gracefully for individual polygons", async () => {
      const polygonUuids = ["uuid-1", "uuid-2"];
      const mockSitePolygon = {
        polygonUuid: "uuid-1",
        siteUuid: "site-uuid-1",
        status: "approved",
        calcArea: 80,
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
          sumAreaSiteApproved: 800,
          sumAreaProjectApproved: 4000
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

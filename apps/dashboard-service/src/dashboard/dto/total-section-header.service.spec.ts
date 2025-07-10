import { TotalSectionHeaderService } from "./total-section-header.service";
import { DashboardProjectsQueryBuilder } from "../dashboard-query.builder";
import {
  DemographicEntry,
  Demographic,
  ProjectReport,
  SitePolygon,
  Site,
  SiteReport,
  TreeSpecies
} from "@terramatch-microservices/database/entities";
import { DashboardQueryDto } from "./dashboard-query.dto";

jest.mock("../dashboard-query.builder");
jest.mock("@terramatch-microservices/database/entities");

const baseMocks = () => {
  const mockBuilder = {
    queryFilters: jest.fn().mockReturnThis(),
    pluckIds: jest.fn().mockResolvedValue([1, 2]),
    execute: jest
      .fn()
      .mockResolvedValue([
        { organisation: { type: "non-profit-organization" } },
        { organisation: { type: "for-profit-organization" } }
      ]),
    sum: jest.fn().mockResolvedValue(100)
  };

  (DashboardProjectsQueryBuilder as jest.Mock).mockImplementation(() => mockBuilder);

  (DemographicEntry.gender as jest.Mock).mockReturnValue({
    sum: jest.fn().mockResolvedValue(50)
  });
  (Demographic.idsSubquery as jest.Mock).mockReturnValue("demo-subquery");
  (ProjectReport.approvedProjectsIdsSubquery as jest.Mock).mockReturnValue("project-subquery");
  (SitePolygon.active as jest.Mock).mockReturnValue({
    approved: jest.fn().mockReturnThis(),
    sites: jest.fn().mockReturnThis(),
    sum: jest.fn().mockResolvedValue(75)
  });
  (Site.approvedUuidsProjectsSubquery as jest.Mock).mockReturnValue("site-subquery");
  (Site.approvedIdsProjectsSubquery as jest.Mock).mockResolvedValue("approved-sites");
  (SiteReport.approvedIdsSubquery as jest.Mock).mockResolvedValue("approved-site-reports");
  (TreeSpecies.visible as jest.Mock).mockReturnValue({
    collection: jest.fn().mockReturnThis(),
    siteReports: jest.fn().mockReturnThis(),
    sum: jest.fn().mockResolvedValue(125)
  });

  return mockBuilder;
};

describe("TotalSectionHeaderService - filters", () => {
  let service: TotalSectionHeaderService;

  beforeEach(() => {
    service = new TotalSectionHeaderService();
    jest.clearAllMocks();
  });

  it("should apply basic filters in DashboardProjectsQueryBuilder", async () => {
    const filters: DashboardQueryDto = {
      organisationType: ["org-uuid-1"],
      country: "BJ",
      programmes: ["terrafund"],
      projectUuid: "uuid",
      landscapes: ["gcb"]
    };

    const mockBuilder = {
      queryFilters: jest.fn().mockReturnThis(),
      pluckIds: jest.fn().mockResolvedValue([1, 2]),
      execute: jest
        .fn()
        .mockResolvedValue([
          { organisation: { type: "non-profit-organization" } },
          { organisation: { type: "for-profit-organization" } }
        ]),
      sum: jest.fn().mockResolvedValue(100)
    };

    (DashboardProjectsQueryBuilder as jest.Mock).mockImplementation(() => mockBuilder);

    (DemographicEntry.gender as jest.Mock).mockReturnValue({
      sum: jest.fn().mockResolvedValue(50)
    });
    (Demographic.idsSubquery as jest.Mock).mockReturnValue("demo-subquery");
    (ProjectReport.approvedProjectsIdsSubquery as jest.Mock).mockReturnValue("project-subquery");
    (SitePolygon.active as jest.Mock).mockReturnValue({
      approved: jest.fn().mockReturnThis(),
      sites: jest.fn().mockReturnThis(),
      sum: jest.fn().mockResolvedValue(75)
    });
    (Site.approvedUuidsProjectsSubquery as jest.Mock).mockReturnValue("site-subquery");
    (Site.approvedIdsProjectsSubquery as jest.Mock).mockResolvedValue("approved-sites");
    (SiteReport.approvedIdsSubquery as jest.Mock).mockResolvedValue("approved-site-reports");
    (TreeSpecies.visible as jest.Mock).mockReturnValue({
      collection: jest.fn().mockReturnThis(),
      siteReports: jest.fn().mockReturnThis(),
      sum: jest.fn().mockResolvedValue(125)
    });

    const result = await service.getTotalSectionHeader(filters);

    expect(mockBuilder.queryFilters).toHaveBeenCalledWith(filters);

    expect(result).toEqual({
      totalNonProfitCount: 1,
      totalEnterpriseCount: 1,
      totalEntries: 50,
      totalHectaresRestored: 75,
      totalHectaresRestoredGoal: 100,
      totalTreesRestored: 125,
      totalTreesRestoredGoal: 100
    });
  });

  it("should handle empty filters (no filters)", async () => {
    const filters: DashboardQueryDto = {};

    const mockBuilder = {
      queryFilters: jest.fn().mockReturnThis(),
      pluckIds: jest.fn().mockResolvedValue([]),
      execute: jest.fn().mockResolvedValue([]),
      sum: jest.fn().mockResolvedValue(0)
    };

    (DashboardProjectsQueryBuilder as jest.Mock).mockImplementation(() => mockBuilder);

    (DemographicEntry.gender as jest.Mock).mockReturnValue({
      sum: jest.fn().mockResolvedValue(0)
    });
    (Demographic.idsSubquery as jest.Mock).mockReturnValue("demo-subquery");
    (ProjectReport.approvedProjectsIdsSubquery as jest.Mock).mockReturnValue("project-subquery");
    (SitePolygon.active as jest.Mock).mockReturnValue({
      approved: jest.fn().mockReturnThis(),
      sites: jest.fn().mockReturnThis(),
      sum: jest.fn().mockResolvedValue(0)
    });
    (Site.approvedUuidsProjectsSubquery as jest.Mock).mockReturnValue("site-subquery");
    (Site.approvedIdsProjectsSubquery as jest.Mock).mockResolvedValue("approved-sites");
    (SiteReport.approvedIdsSubquery as jest.Mock).mockResolvedValue("approved-site-reports");
    (TreeSpecies.visible as jest.Mock).mockReturnValue({
      collection: jest.fn().mockReturnThis(),
      siteReports: jest.fn().mockReturnThis(),
      sum: jest.fn().mockResolvedValue(0)
    });

    const result = await service.getTotalSectionHeader(filters);

    expect(mockBuilder.queryFilters).toHaveBeenCalledWith(filters);
    expect(result).toEqual({
      totalNonProfitCount: 0,
      totalEnterpriseCount: 0,
      totalEntries: 0,
      totalHectaresRestored: 0,
      totalHectaresRestoredGoal: 0,
      totalTreesRestored: 0,
      totalTreesRestoredGoal: 0
    });
  });

  it("should apply filters with country and projectUuid", async () => {
    const filters: DashboardQueryDto = {
      country: "Brazil",
      projectUuid: "uuid-123"
    };

    const mockBuilder = baseMocks();

    const result = await service.getTotalSectionHeader(filters);

    expect(mockBuilder.queryFilters).toHaveBeenCalledWith(filters);
    expect(result.totalNonProfitCount).toBe(1);
    expect(result.totalEnterpriseCount).toBe(1);
  });

  it("should apply programmes filter (array)", async () => {
    const filters: DashboardQueryDto = {
      programmes: ["prog1", "prog2"]
    };

    const mockBuilder = baseMocks();

    const result = await service.getTotalSectionHeader(filters);

    expect(mockBuilder.queryFilters).toHaveBeenCalledWith(filters);
    expect(result.totalNonProfitCount).toBe(1);
  });

  it("should apply landscapes filter (array)", async () => {
    const filters: DashboardQueryDto = {
      landscapes: ["gcb", "grv"]
    };

    const mockBuilder = baseMocks();

    await service.getTotalSectionHeader(filters);

    expect(mockBuilder.queryFilters).toHaveBeenCalledWith(filters);
  });

  it("should apply organisationType filter (array)", async () => {
    const filters: DashboardQueryDto = {
      organisationType: ["non-profit-organization"]
    };

    const mockBuilder = baseMocks();

    await service.getTotalSectionHeader(filters);

    expect(mockBuilder.queryFilters).toHaveBeenCalledWith(filters);
  });

  it("should apply cohort filter (array)", async () => {
    const filters: DashboardQueryDto = {
      cohort: ["cohort-2025"]
    };

    const mockBuilder = baseMocks();

    await service.getTotalSectionHeader(filters);

    expect(mockBuilder.queryFilters).toHaveBeenCalledWith(filters);
  });

  it("should apply combined filters", async () => {
    const filters: DashboardQueryDto = {
      country: "BJ",
      programmes: ["terrafund"],
      organisationType: ["for-profit-organization"],
      cohort: ["terrafund"]
    };

    const mockBuilder = baseMocks();

    await service.getTotalSectionHeader(filters);

    expect(mockBuilder.queryFilters).toHaveBeenCalledWith(filters);
  });

  it("should handle unexpected result without organisation", async () => {
    const mockBuilder = baseMocks();
    mockBuilder.execute.mockResolvedValue([{ foo: "bar" }]);

    const result = await service.getTotalSectionHeader({});

    expect(result.totalNonProfitCount).toBe(0);
    expect(result.totalEnterpriseCount).toBe(0);
  });
});

import { Demographic, ProjectReport } from "@terramatch-microservices/database/entities";
import { TotalJobsCreatedService } from "./total-jobs-created.service";
import { DashboardProjectsQueryBuilder } from "./dashboard-query.builder";
import { DashboardQueryDto } from "./dto/dashboard-query.dto";
import {
  DemographicEntryFactory,
  DemographicFactory,
  ProjectFactory,
  ProjectReportFactory
} from "@terramatch-microservices/database/factories";
import { FULL_TIME, PART_TIME } from "@terramatch-microservices/database/constants/demographic-collections";

jest.mock("./dashboard-query.builder");

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

  (DashboardProjectsQueryBuilder as unknown as jest.Mock).mockImplementation((model, page, include) => mockBuilder);

  return mockBuilder;
};

describe("TotalJobsCreatedService - filters", () => {
  let service: TotalJobsCreatedService;

  beforeEach(() => {
    service = new TotalJobsCreatedService();
    jest.clearAllMocks();
  });

  it("should apply filters with totals equal to Zero", async () => {
    const filters: DashboardQueryDto = {};

    const mockBuilder = baseMocks();

    jest.spyOn(ProjectReport, "findAll").mockImplementation(() => Promise.resolve([]));

    const result = await service.getTotals(filters);

    expect(mockBuilder.queryFilters).toHaveBeenCalledWith(filters);
    expect(result.totalJobsCreated).toBe(0);
    expect(result.totalMen).toBe(0);
    expect(result.totalWomen).toBe(0);
  });

  it("should apply filters with totals", async () => {
    const filters: DashboardQueryDto = {};

    const mockBuilder = baseMocks();

    const project = await ProjectFactory.create();
    const projectReport = await ProjectReportFactory.create({ projectId: project.id });
    jest.spyOn(ProjectReport, "findAll").mockImplementation(() => Promise.resolve([projectReport]));

    const fullTime = await DemographicFactory.forProjectReportJobs.create({
      demographicalId: projectReport.id,
      collection: FULL_TIME
    });
    const partTime = await DemographicFactory.forProjectReportJobs.create({
      demographicalId: projectReport.id,
      collection: PART_TIME
    });
    const entry1 = await DemographicEntryFactory.create({
      demographicId: fullTime.id,
      type: "gender",
      subtype: "male",
      amount: 10
    });
    const entry2 = await DemographicEntryFactory.create({
      demographicId: partTime.id,
      type: "gender",
      subtype: "female",
      amount: 10
    });

    fullTime.entries = [entry1];
    partTime.entries = [entry2];

    jest.spyOn(Demographic, "findAll").mockImplementation(() => Promise.resolve([fullTime, partTime]));

    const result = await service.getTotals(filters);

    expect(mockBuilder.queryFilters).toHaveBeenCalledWith(filters);
    expect(result.totalJobsCreated).toBe(20);
    expect(result.totalMen).toBe(10);
    expect(result.totalWomen).toBe(10);
  });
});

import { Demographic, ProjectReport } from "@terramatch-microservices/database/entities";
import { TotalJobsCreatedService } from "./total-jobs-created.service";
import { DashboardProjectsQueryBuilder } from "./dashboard-query.builder";
import { DashboardQueryDto } from "./dto/dashboard-query.dto";
import { FULL_TIME, PART_TIME } from "@terramatch-microservices/database/constants/demographic-collections";

const mockDemographicEntryFactory = {
  create: jest.fn()
};

const mockDemographicFactory = {
  forProjectReportJobs: {
    create: jest.fn()
  }
};

const mockProjectFactory = {
  create: jest.fn()
};

const mockProjectReportFactory = {
  create: jest.fn()
};

jest.mock("@terramatch-microservices/database/factories", () => ({
  DemographicEntryFactory: mockDemographicEntryFactory,
  DemographicFactory: mockDemographicFactory,
  ProjectFactory: mockProjectFactory,
  ProjectReportFactory: mockProjectReportFactory
}));

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

  (DashboardProjectsQueryBuilder as jest.Mock).mockImplementation(() => mockBuilder);

  return mockBuilder;
};

describe("TotalJobsCreatedService - filters", () => {
  let service: TotalJobsCreatedService;

  beforeEach(() => {
    service = new TotalJobsCreatedService();
    jest.clearAllMocks();
  });

  describe("getTotals", () => {
    it("should return all fields as zero when no data exists", async () => {
      const filters: DashboardQueryDto = {};
      const mockBuilder = baseMocks();
      jest.spyOn(ProjectReport, "findAll").mockImplementation(() => Promise.resolve([] as unknown as ProjectReport[]));
      jest.spyOn(Demographic, "findAll").mockImplementation(() => Promise.resolve([] as unknown as Demographic[]));

      const result = await service.getTotals(filters);

      expect(mockBuilder.queryFilters).toHaveBeenCalledWith(filters);

      expect(result.totalJobsCreated).toBe(0);
      expect(result.totalFt).toBe(0);
      expect(result.totalPt).toBe(0);
      expect(result.totalMen).toBe(0);
      expect(result.totalWomen).toBe(0);
      expect(result.totalNonBinary).toBe(0);
      expect(result.totalYouth).toBe(0);
      expect(result.totalNonYouth).toBe(0);

      expect(result.totalFtMen).toBe(0);
      expect(result.totalFtWomen).toBe(0);
      expect(result.totalFtNonBinary).toBe(0);
      expect(result.totalFtYouth).toBe(0);
      expect(result.totalFtNonYouth).toBe(0);

      expect(result.totalPtMen).toBe(0);
      expect(result.totalPtWomen).toBe(0);
      expect(result.totalPtNonBinary).toBe(0);
      expect(result.totalPtYouth).toBe(0);
      expect(result.totalPtNonYouth).toBe(0);

      expect(result.totalOthersGender).toBe(0);
      expect(result.totalFtOthersGender).toBe(0);
      expect(result.totalPtOthersGender).toBe(0);
      expect(result.totalOthersAge).toBe(0);
      expect(result.totalFtOthersAge).toBe(0);
      expect(result.totalPtOthersAge).toBe(0);

      expect(result.totalVolunteers).toBe(0);
      expect(result.volunteerMen).toBe(0);
      expect(result.volunteerWomen).toBe(0);
      expect(result.volunteerNonBinary).toBe(0);
      expect(result.volunteerOthers).toBe(0);
      expect(result.volunteerYouth).toBe(0);
      expect(result.volunteerNonYouth).toBe(0);
      expect(result.volunteerAgeOthers).toBe(0);
    });

    it("should calculate totals correctly with job demographics data", async () => {
      const filters: DashboardQueryDto = {};
      const mockBuilder = baseMocks();

      const projectReport = { id: 1 } as unknown as ProjectReport;
      jest
        .spyOn(ProjectReport, "findAll")
        .mockImplementation(() => Promise.resolve([projectReport] as unknown as ProjectReport[]));

      const fullTimeJobs = {
        id: 1,
        collection: FULL_TIME,
        entries: [
          { type: "gender", subtype: "male", amount: 10 },
          { type: "gender", subtype: "female", amount: 8 },
          { type: "gender", subtype: "non-binary", amount: 5 },
          { type: "age", subtype: "youth", amount: 12 },
          { type: "age", subtype: "non-youth", amount: 11 },
          { type: "gender", subtype: "other", amount: 3 },
          { type: "age", subtype: "senior", amount: 2 }
        ]
      } as unknown as Demographic;

      const partTimeJobs = {
        id: 2,
        collection: PART_TIME,
        entries: [
          { type: "gender", subtype: "male", amount: 15 },
          { type: "gender", subtype: "female", amount: 12 },
          { type: "gender", subtype: "non-binary", amount: 7 },
          { type: "age", subtype: "youth", amount: 18 },
          { type: "age", subtype: "non-youth", amount: 16 },
          { type: "gender", subtype: "prefer-not-to-say", amount: 4 },
          { type: "age", subtype: "middle-aged", amount: 3 }
        ]
      } as unknown as Demographic;

      jest.spyOn(Demographic, "findAll").mockImplementation((options?: { where?: { type?: string } }) => {
        if (options?.where?.type === "jobs") {
          return Promise.resolve([fullTimeJobs, partTimeJobs] as unknown as Demographic[]);
        }
        return Promise.resolve([] as unknown as Demographic[]);
      });

      const result = await service.getTotals(filters);

      expect(mockBuilder.queryFilters).toHaveBeenCalledWith(filters);

      expect(result.totalJobsCreated).toBe(10 + 8 + 5 + 15 + 12 + 7 + 3 + 4);
      expect(result.totalFt).toBe(10 + 8 + 5 + 3);
      expect(result.totalPt).toBe(15 + 12 + 7 + 4);

      expect(result.totalMen).toBe(10 + 15);
      expect(result.totalWomen).toBe(8 + 12);
      expect(result.totalNonBinary).toBe(5 + 7);
      expect(result.totalFtMen).toBe(10);
      expect(result.totalFtWomen).toBe(8);
      expect(result.totalFtNonBinary).toBe(5);
      expect(result.totalPtMen).toBe(15);
      expect(result.totalPtWomen).toBe(12);
      expect(result.totalPtNonBinary).toBe(7);

      expect(result.totalYouth).toBe(12 + 18);
      expect(result.totalNonYouth).toBe(11 + 16);
      expect(result.totalFtYouth).toBe(12);
      expect(result.totalFtNonYouth).toBe(11);
      expect(result.totalPtYouth).toBe(18);
      expect(result.totalPtNonYouth).toBe(16);

      expect(result.totalOthersGender).toBe(3 + 4);
      expect(result.totalFtOthersGender).toBe(3);
      expect(result.totalPtOthersGender).toBe(4);
      expect(result.totalOthersAge).toBe(2 + 3);
      expect(result.totalFtOthersAge).toBe(2);
      expect(result.totalPtOthersAge).toBe(3);

      expect(result.totalVolunteers).toBe(0);
      expect(result.volunteerMen).toBe(0);
      expect(result.volunteerWomen).toBe(0);
      expect(result.volunteerNonBinary).toBe(0);
      expect(result.volunteerOthers).toBe(0);
      expect(result.volunteerYouth).toBe(0);
      expect(result.volunteerNonYouth).toBe(0);
      expect(result.volunteerAgeOthers).toBe(0);
    });

    it("should calculate totals correctly with volunteer demographics data", async () => {
      const filters: DashboardQueryDto = {};
      const mockBuilder = baseMocks();

      const projectReport = { id: 1 } as unknown as ProjectReport;
      jest
        .spyOn(ProjectReport, "findAll")
        .mockImplementation(() => Promise.resolve([projectReport] as unknown as ProjectReport[]));

      const volunteerDemographics = {
        id: 1,
        collection: "volunteers",
        entries: [
          { type: "gender", subtype: "male", amount: 20 },
          { type: "gender", subtype: "female", amount: 18 },
          { type: "gender", subtype: "non-binary", amount: 8 },
          { type: "age", subtype: "youth", amount: 25 },
          { type: "age", subtype: "non-youth", amount: 21 },
          { type: "gender", subtype: "prefer-not-to-say", amount: 5 },
          { type: "age", subtype: "senior", amount: 4 }
        ]
      } as unknown as Demographic;

      jest.spyOn(Demographic, "findAll").mockImplementation((options?: { where?: { type?: string } }) => {
        if (options?.where?.type === "jobs") {
          return Promise.resolve([] as unknown as Demographic[]);
        }
        if (options?.where?.type === "volunteers") {
          return Promise.resolve([volunteerDemographics] as unknown as Demographic[]);
        }
        return Promise.resolve([] as unknown as Demographic[]);
      });

      const result = await service.getTotals(filters);

      expect(mockBuilder.queryFilters).toHaveBeenCalledWith(filters);

      expect(result.totalJobsCreated).toBe(0);
      expect(result.totalFt).toBe(0);
      expect(result.totalPt).toBe(0);
      expect(result.totalMen).toBe(0);
      expect(result.totalWomen).toBe(0);
      expect(result.totalNonBinary).toBe(0);
      expect(result.totalYouth).toBe(0);
      expect(result.totalNonYouth).toBe(0);

      expect(result.totalVolunteers).toBe(20 + 18 + 8 + 5);
      expect(result.volunteerMen).toBe(20);
      expect(result.volunteerWomen).toBe(18);
      expect(result.volunteerNonBinary).toBe(8);
      expect(result.volunteerYouth).toBe(25);
      expect(result.volunteerNonYouth).toBe(21);
      expect(result.volunteerOthers).toBe(5);
      expect(result.volunteerAgeOthers).toBe(4);
    });

    it("should handle mixed job and volunteer data correctly", async () => {
      const filters: DashboardQueryDto = {};
      const mockBuilder = baseMocks();

      const projectReport = { id: 1 } as unknown as ProjectReport;
      jest
        .spyOn(ProjectReport, "findAll")
        .mockImplementation(() => Promise.resolve([projectReport] as unknown as ProjectReport[]));

      const fullTimeJobs = {
        id: 1,
        collection: FULL_TIME,
        entries: [{ type: "gender", subtype: "male", amount: 10 }]
      } as unknown as Demographic;

      const volunteerDemographics = {
        id: 2,
        collection: "volunteers",
        entries: [{ type: "gender", subtype: "male", amount: 15 }]
      } as unknown as Demographic;

      jest.spyOn(Demographic, "findAll").mockImplementation((options?: { where?: { type?: string } }) => {
        if (options?.where?.type === "jobs") {
          return Promise.resolve([fullTimeJobs] as unknown as Demographic[]);
        }
        if (options?.where?.type === "volunteers") {
          return Promise.resolve([volunteerDemographics] as unknown as Demographic[]);
        }
        return Promise.resolve([] as unknown as Demographic[]);
      });

      const result = await service.getTotals(filters);

      expect(mockBuilder.queryFilters).toHaveBeenCalledWith(filters);

      expect(result.totalJobsCreated).toBe(10);
      expect(result.totalFt).toBe(10);
      expect(result.totalMen).toBe(10);
      expect(result.totalFtMen).toBe(10);

      expect(result.totalVolunteers).toBe(15);
      expect(result.volunteerMen).toBe(15);
    });

    it("should apply filters correctly", async () => {
      const filters: DashboardQueryDto = {
        country: "Kenya",
        programmes: ["terrafund"],
        cohort: ["2023"]
      };
      const mockBuilder = baseMocks();

      jest.spyOn(ProjectReport, "findAll").mockImplementation(() => Promise.resolve([] as unknown as ProjectReport[]));
      jest.spyOn(Demographic, "findAll").mockImplementation(() => Promise.resolve([] as unknown as Demographic[]));

      await service.getTotals(filters);

      expect(mockBuilder.queryFilters).toHaveBeenCalledWith(filters);
    });
  });

  describe("service initialization", () => {
    it("should be defined", () => {
      expect(service).toBeDefined();
    });
  });
});

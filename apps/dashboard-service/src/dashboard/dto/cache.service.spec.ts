import { Test, TestingModule } from "@nestjs/testing";
import { CacheService } from "./cache.service";
import { DashboardQueryDto } from "./dashboard-query.dto";

describe("CacheService", () => {
  let service: CacheService;
  let redisMock: Partial<{ get: jest.Mock; set: jest.Mock; del: jest.Mock }>;
  let queueMock: Partial<{ add: jest.Mock }>;

  beforeEach(async () => {
    redisMock = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn()
    };
    queueMock = {
      add: jest.fn()
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CacheService,
        { provide: "default_IORedisModuleConnectionToken", useValue: redisMock },
        { provide: "BullQueue_dashboard", useValue: queueMock }
      ]
    }).compile();

    service = module.get<CacheService>(CacheService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("getTimestampForTotalSectionHeader", () => {
    it("should call redis.get with correct key", async () => {
      redisMock.get!.mockResolvedValue("123456");
      const result = await service.getTimestampForTotalSectionHeader("param1");
      expect(redisMock.get).toHaveBeenCalledWith("dashboard:total-section-header|param1:timestamp");
      expect(result).toBe("123456");
    });
  });

  describe("del", () => {
    it("should call redis.del with the correct key and return result", async () => {
      (redisMock.del as jest.Mock).mockResolvedValue(1);
      const result = await service.del("some-key");
      expect(redisMock.del).toHaveBeenCalledWith("some-key");
      expect(result).toBe(1);
    });
  });

  describe("getTotalSectionHeader", () => {
    it("should add a job to the dashboardQueue", async () => {
      const fakeJob = { id: 1 };
      queueMock.add!.mockResolvedValue(fakeJob);
      const query = { programmes: ["p1"] } as any;
      const result = await service.getTotalSectionHeader("cacheKey1", query, 123);
      expect(queueMock.add).toHaveBeenCalledWith("totalSectionHeader", {
        ...query,
        cacheKey: "cacheKey1",
        delayedJobId: 123
      });
      expect(result).toBe(fakeJob);
    });
  });

  describe("getCacheParameterForProgrammes", () => {
    it("should return empty string when programmes is null or empty", () => {
      expect(service.getCacheParameterForProgrammes(null as any)).toBe("");
      expect(service.getCacheParameterForProgrammes([])).toBe("");
    });

    it("should return sorted joined string otherwise", () => {
      expect(service.getCacheParameterForProgrammes(["z", "a"])).toBe("a,z");
    });
  });

  describe("getCacheParameterForOrganisationType", () => {
    it("should return 'all-orgs' for empty array", () => {
      expect(service.getCacheParameterForOrganisationType([])).toBe("all-orgs");
    });

    it("should return 'all-orgs' if all org types present", () => {
      expect(service.getCacheParameterForOrganisationType(["for-profit-organization", "non-profit-organization"])).toBe(
        "all-orgs"
      );
    });

    it("should return sorted comma string otherwise", () => {
      expect(service.getCacheParameterForOrganisationType(["non-profit-organization"])).toBe("non-profit-organization");
    });
  });

  describe("getCacheParameterForCohort", () => {
    it("should return empty string for empty input", () => {
      expect(service.getCacheParameterForCohort("")).toBe("");
    });

    it("should return same string for non-empty input", () => {
      expect(service.getCacheParameterForCohort("foo")).toBe("foo");
      expect(service.getCacheParameterForCohort("bar")).toBe("bar");
    });
  });

  describe("get", () => {
    it("should return parsed JSON object if valid", async () => {
      (redisMock.get as jest.Mock).mockResolvedValue(JSON.stringify({ foo: "bar" }));
      const result = await service.get("key1");
      expect(result).toEqual({ foo: "bar" });
    });

    it("should return raw string if JSON parse fails", async () => {
      (redisMock.get as jest.Mock).mockResolvedValue("not-json");
      const result = await service.get("key1");
      expect(result).toBe("not-json");
    });

    it("should return null if redis returns null", async () => {
      (redisMock.get as jest.Mock).mockResolvedValue(null);
      const result = await service.get("key1");
      expect(result).toBeNull();
    });
  });

  describe("getCacheKeyFromQuery", () => {
    it("should build correct cache key with full query", () => {
      const query: DashboardQueryDto = {
        programmes: ["prog2", "prog1"],
        landscapes: ["land2", "land1"],
        country: "USA",
        organisationType: ["non-profit-organization", "for-profit-organization"],
        cohort: "cohort2025",
        projectUuid: "uuid-123"
      };

      const key = service.getCacheKeyFromQuery(query);
      expect(key).toBe("prog1,prog2|land1,land2|USA|all-orgs|cohort2025|uuid-123");
    });

    it("should build cache key with missing fields", () => {
      const query = {} as DashboardQueryDto;
      const key = service.getCacheKeyFromQuery(query);
      expect(key).toBe("|||all-orgs||");
    });
  });
});

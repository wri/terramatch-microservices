import { Framework } from "@terramatch-microservices/database/entities";
import { DashboardProjectsQueryBuilder } from "./dashboard-query.builder";
import { DashboardQueryDto } from "./dto/dashboard-query.dto";
import { DashboardFrameworksService } from "./dashboard-frameworks.service";

jest.mock("./dashboard-query.builder");

describe("DashboardFrameworksService", () => {
  let service: DashboardFrameworksService;

  beforeEach(() => {
    service = new DashboardFrameworksService();
    jest.clearAllMocks();
  });

  it("should return empty array when no projects match", async () => {
    const mockBuilder = {
      queryFilters: jest.fn().mockReturnThis(),
      select: jest.fn().mockResolvedValue([])
    };
    (DashboardProjectsQueryBuilder as jest.Mock).mockImplementation(() => mockBuilder);

    const query: DashboardQueryDto = {};
    const result = await service.getFrameworks(query);

    expect(mockBuilder.queryFilters).toHaveBeenCalledWith(query);
    expect(mockBuilder.select).toHaveBeenCalledWith(["frameworkKey"]);
    expect(result).toEqual([]);
  });

  it("should return distinct frameworks sorted by name", async () => {
    const mockBuilder = {
      queryFilters: jest.fn().mockReturnThis(),
      select: jest
        .fn()
        .mockResolvedValue([
          { frameworkKey: "terrafund-landscapes" },
          { frameworkKey: "terrafund" },
          { frameworkKey: "terrafund" }
        ])
    };
    (DashboardProjectsQueryBuilder as jest.Mock).mockImplementation(() => mockBuilder);

    jest
      .spyOn(Framework, "findAll")
      .mockResolvedValue([
        { slug: "terrafund", name: "Terrafund" } as Framework,
        { slug: "terrafund-landscapes", name: "Terrafund Landscapes" } as Framework
      ]);

    const query: DashboardQueryDto = {};
    const result = await service.getFrameworks(query);

    expect(Framework.findAll).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.any(Object),
        attributes: ["slug", "name"]
      })
    );
    expect(result).toEqual([
      { framework_slug: "terrafund-landscapes", name: "Terrafund Landscapes" },
      { framework_slug: "terrafund", name: "Terrafund" }
    ]);
  });

  it("should filter out null frameworkKey", async () => {
    const mockBuilder = {
      queryFilters: jest.fn().mockReturnThis(),
      select: jest.fn().mockResolvedValue([{ frameworkKey: null }, { frameworkKey: "terrafund" }])
    };
    (DashboardProjectsQueryBuilder as jest.Mock).mockImplementation(() => mockBuilder);

    jest.spyOn(Framework, "findAll").mockResolvedValue([{ slug: "terrafund", name: "Terrafund" } as Framework]);

    const result = await service.getFrameworks({});

    expect(Framework.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.any(Object), attributes: ["slug", "name"] })
    );
    expect(result).toEqual([{ framework_slug: "terrafund", name: "Terrafund" }]);
  });
});

import { DashboardSitePolygonsProcessor } from "./dashboard-sitepolygons.processor";
import { CacheService } from "../dto/cache.service";
import { PolicyService } from "@terramatch-microservices/common";
import { SitePolygon, Project } from "@terramatch-microservices/database/entities";
import { DashboardSitePolygonsLightDto } from "../dto/dashboard-sitepolygons.dto";
import { createMock, DeepMocked } from "@golevelup/ts-jest";
import { DashboardQueryDto } from "../dto/dashboard-query.dto";
import { Op } from "sequelize";

describe("DashboardSitePolygonsProcessor", () => {
  let processor: DashboardSitePolygonsProcessor;
  let cacheService: DeepMocked<CacheService>;
  let policyService: DeepMocked<PolicyService>;

  beforeEach(() => {
    cacheService = createMock<CacheService>();
    policyService = createMock<PolicyService>();
    processor = new DashboardSitePolygonsProcessor(cacheService, policyService);
  });

  it("should have correct DTO types", () => {
    expect(processor.LIGHT_DTO).toBe(DashboardSitePolygonsLightDto);
    expect(processor.FULL_DTO).toBe(DashboardSitePolygonsLightDto);
  });

  it("should find one polygon by UUID", async () => {
    const mockPolygon = { uuid: "test-uuid" } as SitePolygon;
    jest.spyOn(SitePolygon, "findOne").mockResolvedValue(mockPolygon);

    const result = await processor.findOne("test-uuid");
    expect(SitePolygon.findOne).toHaveBeenCalledWith({ where: { uuid: "test-uuid" } });
    expect(result).toBe(mockPolygon);
  });

  it("should create light DTO", async () => {
    const mockPolygon = { uuid: "test-uuid" } as SitePolygon;
    const result = await processor.getLightDto(mockPolygon);
    expect(result.id).toBe("test-uuid");
    expect(result.dto).toBeInstanceOf(DashboardSitePolygonsLightDto);
  });

  it("should create full DTO (same as light)", async () => {
    const mockPolygon = { uuid: "test-uuid" } as SitePolygon;
    const result = await processor.getFullDto(mockPolygon);
    expect(result.id).toBe("test-uuid");
    expect(result.dto).toBeInstanceOf(DashboardSitePolygonsLightDto);
  });

  it("should find many polygons with query filters", async () => {
    const mockPolygons = [{ uuid: "uuid-1" }] as SitePolygon[];
    jest.spyOn(SitePolygon, "findAll").mockResolvedValue(mockPolygons);

    const query = { polygonStatus: ["active"], projectUuid: "" } as DashboardQueryDto;
    const result = await processor.findMany(query);

    expect(SitePolygon.findAll).toHaveBeenCalledWith({
      where: { isActive: true, status: { [Op.in]: ["active"] } },
      include: [{ association: "site", attributes: ["projectId", "project_id"] }]
    });
    expect(result).toBe(mockPolygons);
  });

  it("should return [] if projectUuid is given but project not found", async () => {
    jest.spyOn(Project, "findOne").mockResolvedValue(null);

    const query = { projectUuid: "not-found-uuid" } as DashboardQueryDto;
    const result = await processor.findMany(query);

    expect(Project.findOne).toHaveBeenCalledWith({ where: { uuid: "not-found-uuid" }, attributes: ["id"] });
    expect(result).toEqual([]);
  });
});

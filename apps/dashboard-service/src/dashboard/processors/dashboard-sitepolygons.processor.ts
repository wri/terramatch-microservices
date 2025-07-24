import { SitePolygon } from "@terramatch-microservices/database/entities";
import { DashboardEntityProcessor, DtoResult } from "./dashboard-entity-processor";
import { DashboardSitePolygonsLightDto } from "../dto/dashboard-sitepolygons.dto";
import { DashboardQueryDto } from "../dto/dashboard-query.dto";
import { PolicyService } from "@terramatch-microservices/common";
import { CacheService } from "../dto/cache.service";
import { Op } from "sequelize";
import { Project } from "@terramatch-microservices/database/entities";

export class DashboardSitePolygonsProcessor extends DashboardEntityProcessor<
  SitePolygon,
  DashboardSitePolygonsLightDto,
  DashboardSitePolygonsLightDto
> {
  readonly LIGHT_DTO = DashboardSitePolygonsLightDto;
  readonly FULL_DTO = DashboardSitePolygonsLightDto;

  constructor(protected readonly cacheService: CacheService, protected readonly policyService: PolicyService) {
    super(cacheService, policyService);
  }

  public async findOne(uuid: string): Promise<SitePolygon | null> {
    return await SitePolygon.findOne({ where: { uuid } });
  }

  public async findMany(query: DashboardQueryDto): Promise<SitePolygon[]> {
    const where: Record<string, unknown> = { isActive: true };
    if (Array.isArray(query.polygonStatus) && query.polygonStatus.length > 0) {
      where.status = { [Op.in]: query.polygonStatus };
    }
    if (typeof query.projectUuid === "string" && query.projectUuid.trim() !== "") {
      const project = await Project.findOne({ where: { uuid: query.projectUuid }, attributes: ["id"] });
      if (project !== null && project !== undefined) {
        where["$site.project_id$"] = project.id;
      } else {
        return [];
      }
    }
    const polygons = await SitePolygon.findAll({
      where,
      include: [{ association: "site", attributes: ["projectId", "project_id"] }]
    });

    return polygons;
  }

  public async getLightDto(sitePolygon: SitePolygon): Promise<DtoResult<DashboardSitePolygonsLightDto>> {
    const dto = new DashboardSitePolygonsLightDto(sitePolygon);
    return { id: sitePolygon.uuid, dto };
  }

  public async getFullDto(sitePolygon: SitePolygon): Promise<DtoResult<DashboardSitePolygonsLightDto>> {
    return this.getLightDto(sitePolygon);
  }
}

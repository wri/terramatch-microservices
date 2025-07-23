import { Injectable } from "@nestjs/common";
import { Op, WhereOptions } from "sequelize";
import { SitePolygon, Project } from "@terramatch-microservices/database/entities";
import { DashboardSitePolygonsLightDto } from "./dto/dashboard-sitepolygons.dto";

interface DashboardSitePolygonsParams {
  polygonStatus?: string[];
  projectUuid?: string;
}

@Injectable()
export class DashboardSitePolygonsService {
  async getDashboardSitePolygons(params: DashboardSitePolygonsParams): Promise<DashboardSitePolygonsLightDto[]> {
    const where: WhereOptions<SitePolygon> = { isActive: true };

    if (Array.isArray(params.polygonStatus) && params.polygonStatus.length > 0) {
      where.status = { [Op.in]: params.polygonStatus };
    }

    let projectId: number | undefined;
    if (typeof params.projectUuid === "string" && params.projectUuid.trim() !== "") {
      const project = await Project.findOne({ where: { uuid: params.projectUuid }, attributes: ["id"] });
      if (project == null) {
        return [];
      }
      projectId = project.id;
      (where as Record<string, unknown>)["$site.projectId$"] = projectId;
    }

    const polygons = await SitePolygon.findAll({
      where,
      include: [{ association: "site", attributes: ["projectId"] }]
    });

    return polygons.map(polygon => {
      return new DashboardSitePolygonsLightDto(polygon);
    });
  }
}

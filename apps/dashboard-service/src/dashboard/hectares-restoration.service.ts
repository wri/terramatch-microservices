import { Injectable } from "@nestjs/common";
import { DashboardQueryDto } from "./dto/dashboard-query.dto";
import { DashboardProjectsQueryBuilder } from "./dashboard-query.builder";
import { IndicatorOutputHectares, Project, Site, SitePolygon } from "@terramatch-microservices/database/entities";
import { Op } from "sequelize";

@Injectable()
export class HectaresRestorationService {
  async getResult(query: DashboardQueryDto) {
    const HECTARES_BY_RESTORATION = "restorationByStrategy";
    const HECTARES_BY_TARGET_LAND_USE_TYPES = "restorationByLandUse";

    const projectsBuilder = new DashboardProjectsQueryBuilder(Project, [
      {
        association: "organisation",
        attributes: ["uuid", "name", "type"]
      }
    ]).queryFilters(query);

    const projectIds: number[] = await projectsBuilder.pluckIds();
    const projectPolygons = await this.getProjectPolygons(projectIds);
    const polygonsIds = projectPolygons.map(polygon => polygon.id);

    const restorationStrategiesRepresented = await this.getPolygonOutputHectares(HECTARES_BY_RESTORATION, polygonsIds);
    const targetLandUseTypesRepresented = await this.getPolygonOutputHectares(
      HECTARES_BY_TARGET_LAND_USE_TYPES,
      polygonsIds
    );

    if (restorationStrategiesRepresented.length === 0 && targetLandUseTypesRepresented.length === 0) {
      return {
        hectaresByRestoration: [],
        hectaresByTargetLandUse: []
      };
    }
  }

  async getProjectPolygons(projectIds: number[]) {
    if (!projectIds || projectIds.length === 0) {
      return [];
    }

    return await SitePolygon.findAll({
      attributes: ["id"],
      include: [
        {
          model: Site,
          as: "site",
          required: true,
          where: {
            status: {
              [Op.in]: ["approved"]
            }
          },
          include: [
            {
              model: Project,
              as: "project",
              required: true,
              where: {
                uuid: {
                  [Op.in]: projectIds
                }
              }
            }
          ]
        }
      ],
      where: {
        status: "approved",
        isActive: true
      }
    });
  }

  async getPolygonOutputHectares(indicator: string, polygonIds: number[]) {
    return await IndicatorOutputHectares.findAll({
      attributes: ["polygonId", "hectares"],
      where: {
        sitePolygonId: { [Op.in]: polygonIds },
        indicatorSlug: indicator
      }
    });
  }
}

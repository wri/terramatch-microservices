import { Injectable } from "@nestjs/common";
import { DashboardQueryDto } from "./dto/dashboard-query.dto";
import { DashboardProjectsQueryBuilder } from "./dashboard-query.builder";
import { IndicatorOutputHectares, Project, Site, SitePolygon } from "@terramatch-microservices/database/entities";
import { Op } from "sequelize";

@Injectable()
export class HectaresRestorationService {
  async getResults(query: DashboardQueryDto) {
    const hectaresByRestoration = "restorationByStrategy";
    const hectaresByTargetLandUseTypes = "restorationByLandUse";

    const projectsBuilder = new DashboardProjectsQueryBuilder(Project, [
      {
        association: "organisation",
        attributes: ["uuid", "name", "type"]
      }
    ]).queryFilters(query);

    const projectIds: number[] = await projectsBuilder.pluckIds();
    const projectPolygons = await this.getProjectPolygons(projectIds);
    const polygonsIds = projectPolygons.map(polygon => polygon.id);

    const restorationStrategiesRepresented = await this.getPolygonOutputHectares(hectaresByRestoration, polygonsIds);
    const targetLandUseTypesRepresented = await this.getPolygonOutputHectares(
      hectaresByTargetLandUseTypes,
      polygonsIds
    );

    if (restorationStrategiesRepresented.length === 0 && targetLandUseTypesRepresented.length === 0) {
      return {
        restorationStrategiesRepresented: {},
        targetLandUseTypesRepresented: {}
      };
    }

    return {
      restorationStrategiesRepresented: this.calculateGroupedHectares(restorationStrategiesRepresented),
      targetLandUseTypesRepresented: this.calculateGroupedHectares(targetLandUseTypesRepresented)
    };
  }

  private async getProjectPolygons(projectIds: number[]) {
    if (projectIds.length === 0) {
      return [];
    }

    return await SitePolygon.findAll({
      attributes: ["id"],
      include: [
        {
          model: Site,
          as: "site",
          required: true,
          attributes: ["id"],
          where: {
            status: {
              [Op.in]: ["approved", "restoration-in-progress"]
            }
          },
          include: [
            {
              model: Project,
              as: "project",
              required: true,
              attributes: ["id"],
              where: {
                id: {
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

  private async getPolygonOutputHectares(indicator: string, polygonIds: number[]) {
    return await IndicatorOutputHectares.findAll({
      where: {
        sitePolygonId: { [Op.in]: polygonIds },
        indicatorSlug: indicator
      }
    });
  }

  private calculateGroupedHectares(polygonsToOutputHectares: IndicatorOutputHectares[]): Record<string, number> {
    const hectaresRestored: Record<string, number> = {};

    polygonsToOutputHectares.forEach(hectare => {
      const decodedValue = hectare.value;
      if (decodedValue != null) {
        for (const [key, value] of Object.entries(decodedValue)) {
          if (!(key in hectaresRestored)) {
            hectaresRestored[key] = 0;
          }
          hectaresRestored[key] += typeof value === "number" ? value : parseFloat(value as string);
        }
      }
    });

    for (const key in hectaresRestored) {
      hectaresRestored[key] = parseFloat(hectaresRestored[key].toFixed(3));
    }

    return hectaresRestored;
  }
}

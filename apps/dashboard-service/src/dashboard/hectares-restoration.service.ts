import { Injectable } from "@nestjs/common";
import { DashboardQueryDto } from "./dto/dashboard-query.dto";
import { DashboardProjectsQueryBuilder } from "./dashboard-query.builder";
import { IndicatorOutputHectares, Project, Site, SitePolygon } from "@terramatch-microservices/database/entities";
import { Op } from "sequelize";
import { HectareRestorationDto } from "./dto/hectare-restoration.dto";

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
    console.log(projectIds);
    const projectPolygons = await this.getProjectPolygons(projectIds);
    const polygonsIds = projectPolygons.map(polygon => polygon.id);

    console.log(polygonsIds);

    const restorationStrategiesRepresented = await this.getPolygonOutputHectares(HECTARES_BY_RESTORATION, polygonsIds);
    const targetLandUseTypesRepresented = await this.getPolygonOutputHectares(
      HECTARES_BY_TARGET_LAND_USE_TYPES,
      polygonsIds
    );

    if (restorationStrategiesRepresented.length === 0 && targetLandUseTypesRepresented.length === 0) {
      return new HectareRestorationDto({
        restorationStrategiesRepresented: {},
        targetLandUseTypesRepresented: {}
      });
    }

    console.log(this.calculateGroupedHectares(restorationStrategiesRepresented));

    return new HectareRestorationDto({
      restorationStrategiesRepresented: this.calculateGroupedHectares(restorationStrategiesRepresented),
      targetLandUseTypesRepresented: this.calculateGroupedHectares(targetLandUseTypesRepresented)
    });
  }

  private async getProjectPolygons(projectIds: number[]) {
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

  private async getPolygonOutputHectares(indicator: string, polygonIds: number[]) {
    return await IndicatorOutputHectares.findAll({
      // attributes: ["sitePolygonId", "hectares"],
      where: {
        sitePolygonId: { [Op.in]: polygonIds },
        indicatorSlug: indicator
      }
    });
  }

  private calculateGroupedHectares(polygonsToOutputHectares: any[]): Record<string, number> {
    const hectaresRestored: Record<string, number> = {};

    polygonsToOutputHectares.forEach(hectare => {
      let decodedValue: null;

      try {
        decodedValue = JSON.parse(hectare.value);
      } catch {
        decodedValue = null;
      }

      if (decodedValue) {
        for (const [key, value] of Object.entries(decodedValue)) {
          if (!hectaresRestored[key]) {
            hectaresRestored[key] = 0;
          }
          // @ts-ignore
          hectaresRestored[key] += value;
        }
      }
    });

    // Round each value to 3 decimal places
    for (const key in hectaresRestored) {
      hectaresRestored[key] = parseFloat(hectaresRestored[key].toFixed(3));
    }

    return hectaresRestored;
  }
}

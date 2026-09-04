import { Injectable } from "@nestjs/common";
import { DashboardQueryDto } from "./dto/dashboard-query.dto";
import { DashboardProjectsQueryBuilder } from "./dashboard-query.builder";
import { Project, Site, SitePolygon } from "@terramatch-microservices/database/entities";

@Injectable()
export class HectaresRestorationService {
  async getResults(query: DashboardQueryDto) {
    const projectsBuilder = new DashboardProjectsQueryBuilder(Project, [
      {
        association: "organisation",
        attributes: ["uuid", "name", "type"]
      }
    ]).queryFilters(query);

    const projectIds: number[] = await projectsBuilder.pluckIds();
    const projectPolygons = await this.getProjectPolygons(projectIds);

    if (projectPolygons.length === 0) {
      return {
        restorationStrategiesRepresented: {},
        targetLandUseTypesRepresented: {}
      };
    }

    return {
      restorationStrategiesRepresented: this.groupHectaresByKey(projectPolygons, polygon =>
        this.normalizeTypeKey(polygon.practice)
      ),
      targetLandUseTypesRepresented: this.groupHectaresByKey(projectPolygons, polygon =>
        this.normalizeTypeKey(polygon.targetSys)
      )
    };
  }

  private async getProjectPolygons(projectIds: number[]) {
    if (projectIds.length === 0) {
      return [];
    }

    // Same population as TotalSectionHeaderService.getTotalHectaresSum
    return await SitePolygon.active()
      .approved()
      .sites(Site.approvedUuidsProjectsSubquery(projectIds))
      .findAll({
        attributes: ["practice", "targetSys", "calcArea"]
      });
  }

  private normalizeTypeKey(fieldValue: string[] | string | null | undefined): string {
    if (fieldValue == null) {
      return "";
    }

    return (Array.isArray(fieldValue) ? fieldValue.join(",") : String(fieldValue))
      .split(",")
      .map(value => value.trim())
      .filter(value => value.length > 0)
      .join(",");
  }

  private groupHectaresByKey(
    polygons: SitePolygon[],
    getKey: (polygon: SitePolygon) => string
  ): Record<string, number> {
    const hectaresRestored: Record<string, number> = {};

    for (const polygon of polygons) {
      if (polygon.calcArea == null) {
        continue;
      }

      const key = getKey(polygon);
      hectaresRestored[key] = (hectaresRestored[key] ?? 0) + polygon.calcArea;
    }

    for (const key of Object.keys(hectaresRestored)) {
      hectaresRestored[key] = parseFloat(hectaresRestored[key].toFixed(3));
    }

    return hectaresRestored;
  }
}

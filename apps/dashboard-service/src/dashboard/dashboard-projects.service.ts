import { Injectable } from "@nestjs/common";
import { Project, Site, SitePolygon, TreeSpecies, SiteReport } from "@terramatch-microservices/database/entities";
import { DashboardQueryDto } from "./dto/dashboard-query.dto";
import { DashboardProjectsQueryBuilder } from "./dashboard-query.builder";
import { DashboardProjectsLightDto } from "./dto/dashboard-projects.dto";

@Injectable()
export class DashboardProjectsService {
  async getDashboardProjects(query: DashboardQueryDto): Promise<DashboardProjectsLightDto[]> {
    const projectsBuilder = new DashboardProjectsQueryBuilder(Project, [
      {
        association: "organisation",
        attributes: ["uuid", "name", "type"]
      }
    ]).queryFilters(query);

    const projects = await projectsBuilder.execute();

    const projectsData = await Promise.all(
      projects.map(async project => {
        const approvedSitesQuery = Site.approvedIdsSubquery(project.id);
        const approvedSiteReportsQuery = SiteReport.approvedIdsSubquery(approvedSitesQuery);
        const totalSites = await Site.approved().project(project.id).count();
        const totalHectaresRestoredSum =
          (await SitePolygon.active().approved().sites(Site.approvedUuidsSubquery(project.id)).sum("calcArea")) ?? 0;

        const treesPlantedCount =
          (await TreeSpecies.visible()
            .collection("tree-planted")
            .siteReports(approvedSiteReportsQuery)
            .sum("amount")) ?? 0;

        return new DashboardProjectsLightDto({
          uuid: project.uuid,
          country: project.country,
          frameworkKey: project.frameworkKey,
          name: project.name,
          organisationName: project.organisation?.name ?? null,
          treesPlantedCount: treesPlantedCount,
          totalHectaresRestoredSum: totalHectaresRestoredSum,
          lat: project.lat,
          long: project.long,
          organisationType: project.organisation?.type ?? null,
          treesGrownGoal: project.treesGrownGoal,
          totalSites: totalSites
        });
      })
    );

    return projectsData;
  }
}

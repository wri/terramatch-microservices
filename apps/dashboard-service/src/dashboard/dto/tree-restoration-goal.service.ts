import { Injectable } from "@nestjs/common";
import { Project, Site, SiteReport, TreeSpecies } from "@terramatch-microservices/database/entities";
import { DashboardQueryDto } from "./dashboard-query.dto";
import { DashboardProjectsQueryBuilder } from "../dashboard-query.builder";

@Injectable()
export class TreeRestorationGoalService {
  async getTreeRestorationGoal(query: DashboardQueryDto) {
    const projectsBuilder = new DashboardProjectsQueryBuilder(Project, [
      {
        association: "organisation",
        attributes: ["uuid", "name", "type"]
      }
    ]).queryFilters(query);

    const projectIds: number[] = await projectsBuilder.pluckIds();

    return {
      forProfitTreeCount: await this.getForProfitTreeCount(projectIds)
    };
  }

  private async getForProfitTreeCount(projectIds: number[]) {
    const projects = await Project.findAll({
      where: { id: projectIds },
      include: [
        {
          association: "organisation",
          attributes: ["type"]
        }
      ]
    });

    const forProfitProjectIds = projects
      .filter(project => project.organisation?.type === "for-profit-organization")
      .map(project => project.id);

    const approvedSitesQuery = await Site.approvedIdsProjectsSubquery(forProfitProjectIds);
    const approvedSiteReportsQuery = await SiteReport.approvedIdsSubquery(approvedSitesQuery);

    return (
      (await TreeSpecies.visible().collection("tree-planted").siteReports(approvedSiteReportsQuery).sum("amount")) ?? 0
    );
  }
}

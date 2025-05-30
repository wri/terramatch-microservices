import { Injectable } from "@nestjs/common";
import { Project, Site, SiteReport, TreeSpecies } from "@terramatch-microservices/database/entities";
import { DashboardQueryDto } from "./dashboard-query.dto";
import { DashboardProjectsQueryBuilder } from "../dashboard-query.builder";
import { Op } from "sequelize";

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

    const nonProfitProjectIds = projects
      .filter(project => project.organisation?.type === "non-profit-organization")
      .map(project => project.id);

    const [forProfitTreeCount, nonProfitTreeCount, totalTreesGrownGoal] = await Promise.all([
      this.getTreeCount(forProfitProjectIds),
      this.getTreeCount(nonProfitProjectIds),
      projectsBuilder.sum("treesGrownGoal")
    ]);

    return {
      forProfitTreeCount,
      nonProfitTreeCount,
      totalTreesGrownGoal: totalTreesGrownGoal ?? 0
    };
  }

  private async getTreeCount(projectIds: number[]) {
    if (projectIds.length === 0) return 0;

    const approvedSitesQuery = await Site.approvedIdsProjectsSubquery(projectIds);
    const approvedSiteReportsQuery = await SiteReport.approvedIdsSubquery(approvedSitesQuery);

    return (
      (await TreeSpecies.visible().collection("tree-planted").siteReports(approvedSiteReportsQuery).sum("amount")) ?? 0
    );
  }
}

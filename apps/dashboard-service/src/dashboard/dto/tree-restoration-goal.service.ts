import { Injectable } from "@nestjs/common";
import { Project, Site, SiteReport, TreeSpecies } from "@terramatch-microservices/database/entities";
import { DashboardQueryDto } from "./dashboard-query.dto";
import { DashboardProjectsQueryBuilder } from "../dashboard-query.builder";
import { Op, fn, col, literal } from "sequelize";

interface DateResult {
  year: number;
  month: number;
}

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

    const distinctDates = await this.getDistinctDates(projectIds);
    const [
      treesUnderRestorationActualTotal,
      treesUnderRestorationActualForProfit,
      treesUnderRestorationActualNonProfit
    ] = await Promise.all([
      this.calculateTreesUnderRestoration(projectIds, distinctDates, totalTreesGrownGoal ?? 0),
      this.calculateTreesUnderRestoration(forProfitProjectIds, distinctDates, totalTreesGrownGoal ?? 0),
      this.calculateTreesUnderRestoration(nonProfitProjectIds, distinctDates, totalTreesGrownGoal ?? 0)
    ]);

    return {
      forProfitTreeCount,
      nonProfitTreeCount,
      totalTreesGrownGoal: totalTreesGrownGoal ?? 0,
      treesUnderRestorationActualTotal,
      treesUnderRestorationActualForProfit,
      treesUnderRestorationActualNonProfit
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

  private async getDistinctDates(projectIds: number[]) {
    if (projectIds.length === 0) return [];

    const approvedSitesQuery = await Site.approvedIdsProjectsSubquery(projectIds);
    const approvedSiteReportsQuery = await SiteReport.approvedIdsSubquery(approvedSitesQuery);

    const siteReports = (await SiteReport.findAll({
      where: {
        id: { [Op.in]: approvedSiteReportsQuery }
      },
      attributes: [
        [fn("YEAR", col("due_at")), "year"],
        [fn("MONTH", col("due_at")), "month"]
      ],
      group: [fn("YEAR", col("due_at")), fn("MONTH", col("due_at"))],
      order: [
        [fn("YEAR", col("due_at")), "ASC"],
        [fn("MONTH", col("due_at")), "ASC"]
      ],
      raw: true
    })) as unknown as DateResult[];

    return siteReports.map(report => ({
      year: report.year,
      month: report.month
    }));
  }

  private async calculateTreesUnderRestoration(
    projectIds: number[],
    distinctDates: { year: number; month: number }[],
    totalTreesGrownGoal: number
  ) {
    if (projectIds.length === 0 || distinctDates.length === 0) return [];

    const approvedSitesQuery = await Site.approvedIdsProjectsSubquery(projectIds);
    const approvedSiteReportsQuery = await SiteReport.approvedIdsSubquery(approvedSitesQuery);

    const results = await Promise.all(
      distinctDates.map(async ({ year, month }) => {
        const siteReports = await SiteReport.findAll({
          where: {
            id: { [Op.in]: approvedSiteReportsQuery },
            [Op.and]: [literal(`YEAR(due_at) = ${year}`), literal(`MONTH(due_at) = ${month}`)]
          },
          include: [
            {
              model: TreeSpecies,
              as: "treesPlanted",
              required: false,
              where: {
                hidden: false,
                collection: "tree-planted"
              }
            }
          ]
        });

        const treeSpeciesAmount = siteReports.reduce((sum, report) => {
          return sum + (report.treesPlanted?.reduce((reportSum, tree) => reportSum + (tree.amount ?? 0), 0) ?? 0);
        }, 0);

        const formattedDate = new Date(year, month - 1, 1);
        const percentage =
          totalTreesGrownGoal > 0 ? Number(((treeSpeciesAmount / totalTreesGrownGoal) * 100).toFixed(3)) : 0;

        return {
          dueDate: formattedDate,
          treeSpeciesAmount,
          treeSpeciesPercentage: percentage
        };
      })
    );

    return results;
  }
}

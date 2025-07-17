import { Injectable } from "@nestjs/common";
import { Project, Site, SiteReport, TreeSpecies } from "@terramatch-microservices/database/entities";
import { DashboardQueryDto } from "./dashboard-query.dto";
import { DashboardProjectsQueryBuilder } from "../dashboard-query.builder";
import { Op, fn, col } from "sequelize";
import { Literal } from "sequelize/types/utils";
import { sumBy } from "lodash";

interface DateResult {
  year: number;
  month: number;
}

@Injectable()
export class TreeRestorationGoalService {
  async getTreeRestorationGoal(query: DashboardQueryDto) {
    const projectsBuilder = new DashboardProjectsQueryBuilder(Project, query, [
      {
        association: "organisation",
        attributes: ["uuid", "name", "type"]
      }
    ]).queryFilters(query);

    const projects = await projectsBuilder.execute();

    const projectIds = projects.map(project => project.id);
    const forProfitProjectIds = projects
      .filter(project => project.organisation?.type === "for-profit-organization")
      .map(project => project.id);

    const nonProfitProjectIds = projects
      .filter(project => project.organisation?.type === "non-profit-organization")
      .map(project => project.id);

    const totalTreesGrownGoal = sumBy(projects, "treesGrownGoal") ?? 0;

    const approvedSitesQuery = projectIds.length > 0 ? Site.approvedIdsProjectsSubquery(projectIds) : undefined;
    const forProfitApprovedSitesQuery =
      forProfitProjectIds.length > 0 ? Site.approvedIdsProjectsSubquery(forProfitProjectIds) : undefined;
    const nonProfitApprovedSitesQuery =
      nonProfitProjectIds.length > 0 ? Site.approvedIdsProjectsSubquery(nonProfitProjectIds) : undefined;

    const [forProfitTreeCount, nonProfitTreeCount] = await Promise.all([
      forProfitApprovedSitesQuery !== undefined ? this.getTreeCount(forProfitApprovedSitesQuery) : 0,
      nonProfitApprovedSitesQuery !== undefined ? this.getTreeCount(nonProfitApprovedSitesQuery) : 0
    ]);

    const distinctDates = approvedSitesQuery !== undefined ? await this.getDistinctDates(approvedSitesQuery) : [];

    const [
      treesUnderRestorationActualTotal,
      treesUnderRestorationActualForProfit,
      treesUnderRestorationActualNonProfit
    ] = await Promise.all([
      approvedSitesQuery !== undefined
        ? this.calculateTreesUnderRestoration(approvedSitesQuery, distinctDates, totalTreesGrownGoal)
        : [],
      forProfitApprovedSitesQuery !== undefined
        ? this.calculateTreesUnderRestoration(forProfitApprovedSitesQuery, distinctDates, totalTreesGrownGoal)
        : [],
      nonProfitApprovedSitesQuery !== undefined
        ? this.calculateTreesUnderRestoration(nonProfitApprovedSitesQuery, distinctDates, totalTreesGrownGoal)
        : []
    ]);

    return {
      forProfitTreeCount,
      nonProfitTreeCount,
      totalTreesGrownGoal,
      treesUnderRestorationActualTotal,
      treesUnderRestorationActualForProfit,
      treesUnderRestorationActualNonProfit
    };
  }

  private async getTreeCount(approvedSitesQuery: Literal) {
    const approvedSiteReportsQuery = await SiteReport.approvedIdsSubquery(approvedSitesQuery);

    return (
      (await TreeSpecies.visible().collection("tree-planted").siteReports(approvedSiteReportsQuery).sum("amount")) ?? 0
    );
  }

  private async getDistinctDates(approvedSitesQuery: Literal) {
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

    return (siteReports ?? []).map(report => ({
      year: report.year,
      month: report.month
    }));
  }

  private async calculateTreesUnderRestoration(
    approvedSitesQuery: Literal,
    distinctDates: { year: number; month: number }[],
    totalTreesGrownGoal: number
  ) {
    if (distinctDates.length === 0) return [];

    const approvedSiteReportsQuery = await SiteReport.approvedIdsSubquery(approvedSitesQuery);

    const allSiteReports = await SiteReport.findAll({
      where: {
        id: { [Op.in]: approvedSiteReportsQuery }
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

    const siteReportsByDate = new Map<string, SiteReport[]>();

    allSiteReports.forEach(report => {
      if (report.dueAt != null) {
        const year = report.dueAt.getFullYear();
        const month = report.dueAt.getMonth() + 1;
        const key = `${year}-${month}`;

        if (!siteReportsByDate.has(key)) {
          siteReportsByDate.set(key, []);
        }
        siteReportsByDate.get(key)?.push(report);
      }
    });

    return distinctDates.map(({ year, month }) => {
      const key = `${year}-${month}`;
      const siteReportsForDate = siteReportsByDate.get(key) ?? [];

      const treeSpeciesAmount = sumBy(siteReportsForDate, report =>
        sumBy(report.treesPlanted ?? [], tree => tree.amount ?? 0)
      );

      const formattedDate = new Date(year, month - 1, 1);

      return {
        dueDate: formattedDate,
        treeSpeciesAmount,
        treeSpeciesGoal: totalTreesGrownGoal
      };
    });
  }
}

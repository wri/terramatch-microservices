import { Injectable } from "@nestjs/common";
import {
  Project,
  ProjectReport,
  Site,
  SitePolygon,
  SiteReport,
  TreeSpecies
} from "@terramatch-microservices/database/entities";
import { literal } from "sequelize";
import { DashboardQueryDto } from "./dashboard-query.dto";
import { DashboardProjectsQueryBuilder } from "@terramatch-microservices/database/util/dashboard-query.builder";

@Injectable()
export class TotalSectionHeaderService {
  constructor() {}

  async getTotalSectionHeader(query: DashboardQueryDto) {
    const projectsBuilder = new DashboardProjectsQueryBuilder(Project, [
      {
        association: "organisation",
        attributes: ["uuid", "name", "type"]
      }
    ]).queryFilters(query);
    const projects = await projectsBuilder;
    const projectIds = await projects.pluckIds();

    return {
      totalNonProfitCount: await this.getTotalNonProfitCount(projects),
      totalEnterpriseCount: await this.getTotalEnterpriseCount(projects),
      totalEntries: await this.getTotalJobsCreatedSum(projectIds),
      totalHectaresRestored: await this.getTotalHectaresSum(projectIds),
      totalHectaresRestoredGoal:
        (await projects.select(["totalHectaresRestoredGoal"]).sum("totalHectaresRestoredGoal")) ?? 0,
      totalTreesRestored: await this.getTotalTreesRestoredSum(projectIds),
      totalTreesRestoredGoal: (await projects.select(["treesGrownGoal"]).sum("treesGrownGoal")) ?? 0
    };
  }

  async getTotalNonProfitCount(projects) {
    const totalNonProfit = (await projects.select(["organisation.type"]).execute()).filter(
      project => project.organisationType == "non-profit-organization"
    ).length;
    return totalNonProfit ?? 0;
  }

  async getTotalEnterpriseCount(projects) {
    const totalForProfit = (await projects.select(["organisation.type"]).execute()).filter(
      project => project.organisationType == "for-profit-organization"
    ).length;
    return totalForProfit ?? 0;
  }

  async getTotalJobsCreatedSum(projectsIds) {
    const totalJobs = await ProjectReport.approved()
      .projectsIds(projectsIds)
      .findOne({
        attributes: [[literal("SUM(COALESCE(ft_total, 0) + COALESCE(pt_total, 0))"), "totalJobs"]],
        raw: true
      });

    return (totalJobs as any)?.totalJobs ?? 0;
  }

  async getTotalHectaresSum(projectsIds) {
    if (!projectsIds.length) {
      return 0;
    }
    const totalHectaresRestoredSum =
      (await SitePolygon.active().approved().sites(Site.approvedUuidsProjectsSubquery(projectsIds)).sum("calcArea")) ??
      0;
    return totalHectaresRestoredSum;
  }

  async getTotalTreesRestoredSum(projectsIds) {
    if (!projectsIds.length) {
      return 0;
    }
    const approvedSitesQuery = await Site.approvedIdsProjectsSubquery(projectsIds);
    const approvedSiteReportsQuery = await SiteReport.approvedIdsSubquery(approvedSitesQuery);

    const treesPlantedCount =
      (await TreeSpecies.visible().collection("tree-planted").siteReports(approvedSiteReportsQuery).sum("amount")) ?? 0;
    return treesPlantedCount ?? 0;
  }
}

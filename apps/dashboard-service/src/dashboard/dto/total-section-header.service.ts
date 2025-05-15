import { Injectable } from "@nestjs/common";
import {
  Demographic,
  DemographicEntry,
  Project,
  ProjectReport,
  Site,
  SitePolygon,
  SiteReport,
  TreeSpecies
} from "@terramatch-microservices/database/entities";
import { Op } from "sequelize";
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
    const projectIds: number[] = await projects.pluckIds();

    return {
      totalNonProfitCount: await this.getTotalNonProfitCount(projects),
      totalEnterpriseCount: await this.getTotalEnterpriseCount(projects),
      totalEntries: await this.getTotalJobs(projectIds),
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

  async getTotalJobs(projectIds: number[]) {
    return (
      (await DemographicEntry.gender().sum("amount", {
        where: {
          demographicId: {
            [Op.in]: Demographic.idsSubquery(
              ProjectReport.approvedIdsSubqueryProjects(projectIds),
              ProjectReport.LARAVEL_TYPE,
              Demographic.JOBS_TYPE
            )
          }
        }
      })) ?? 0
    );
  }

  async getTotalHectaresSum(projectsIds: number[]) {
    if (!projectsIds.length) {
      return 0;
    }
    const totalHectaresRestoredSum =
      (await SitePolygon.active().approved().sites(Site.approvedUuidsSubqueryProjects(projectsIds)).sum("calcArea")) ??
      0;
    return totalHectaresRestoredSum;
  }

  async getTotalTreesRestoredSum(projectsIds: number[]) {
    if (!projectsIds.length) {
      return 0;
    }
    const approvedSitesQuery = await Site.approvedIdsSubqueryProjects(projectsIds);
    const approvedSiteReportsQuery = await SiteReport.approvedIdsSubquery(approvedSitesQuery);

    const treesPlantedCount =
      (await TreeSpecies.visible().collection("tree-planted").siteReports(approvedSiteReportsQuery).sum("amount")) ?? 0;
    return treesPlantedCount ?? 0;
  }
}

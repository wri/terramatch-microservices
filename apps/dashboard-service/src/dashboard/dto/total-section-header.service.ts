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
import { DashboardProjectsQueryBuilder } from "../dashboard-query.builder";

@Injectable()
export class TotalSectionHeaderService {
  async getTotalSectionHeader(query: DashboardQueryDto) {
    const projectsBuilder = new DashboardProjectsQueryBuilder(Project, query, [
      {
        association: "organisation",
        attributes: ["uuid", "name", "type"]
      }
    ]).queryFilters(query);

    const projectIds: number[] = await projectsBuilder.pluckIds();

    return {
      totalNonProfitCount: await this.getTotalNonProfitCount(projectsBuilder),
      totalEnterpriseCount: await this.getTotalEnterpriseCount(projectsBuilder),
      totalEntries: await this.getTotalJobs(projectIds),
      totalHectaresRestored: await this.getTotalHectaresSum(projectIds),
      totalHectaresRestoredGoal: (await projectsBuilder.sum("totalHectaresRestoredGoal")) ?? 0,
      totalTreesRestored: await this.getTotalTreesRestoredSum(projectIds),
      totalTreesRestoredGoal: (await projectsBuilder.sum("treesGrownGoal")) ?? 0
    };
  }

  async getTotalNonProfitCount(projectsBuilder: DashboardProjectsQueryBuilder) {
    const projects = await projectsBuilder.execute();

    const totalNonProfit = projects.filter(project => project.organisation?.type === "non-profit-organization").length;

    return totalNonProfit ?? 0;
  }

  async getTotalEnterpriseCount(projectsBuilder: DashboardProjectsQueryBuilder) {
    const projects = await projectsBuilder.execute();
    const totalEnterprise = projects.filter(project => project.organisation?.type === "for-profit-organization").length;

    return totalEnterprise ?? 0;
  }

  async getTotalJobs(projectIds: number[]) {
    if (projectIds.length === 0) {
      return 0;
    }
    return (
      (await DemographicEntry.gender().sum("amount", {
        where: {
          demographicId: {
            [Op.in]: Demographic.idsSubquery(
              ProjectReport.approvedProjectsIdsSubquery(projectIds),
              ProjectReport.LARAVEL_TYPE,
              Demographic.JOBS_TYPE
            )
          }
        }
      })) ?? 0
    );
  }

  async getTotalHectaresSum(projectsIds: number[]) {
    if (projectsIds.length === 0) {
      return 0;
    }

    return (
      (await SitePolygon.active().approved().sites(Site.approvedUuidsProjectsSubquery(projectsIds)).sum("calcArea")) ??
      0
    );
  }

  async getTotalTreesRestoredSum(projectsIds: number[]) {
    if (projectsIds.length === 0) {
      return 0;
    }
    const approvedSitesQuery = await Site.approvedIdsProjectsSubquery(projectsIds);
    const approvedSiteReportsQuery = await SiteReport.approvedIdsSubquery(approvedSitesQuery);

    const treesPlantedCount =
      (await TreeSpecies.visible().collection("tree-planted").siteReports(approvedSiteReportsQuery).sum("amount")) ?? 0;
    return treesPlantedCount ?? 0;
  }
}

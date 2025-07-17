import { Injectable } from "@nestjs/common";
import {
  Project,
  Site,
  SitePolygon,
  TreeSpecies,
  SiteReport,
  DemographicEntry,
  Demographic,
  ProjectReport
} from "@terramatch-microservices/database/entities";
import { Op } from "sequelize";
import { DashboardQueryDto } from "./dto/dashboard-query.dto";
import { DashboardProjectsQueryBuilder } from "./dashboard-query.builder";
import { DashboardProjectsLightDto } from "./dto/dashboard-projects.dto";
import { HybridSupportProps } from "@terramatch-microservices/common/dto/hybrid-support.dto";

@Injectable()
export class DashboardProjectsService {
  protected async getTotalJobs(projectId: number) {
    return (
      (await DemographicEntry.gender().sum("amount", {
        where: {
          demographicId: {
            [Op.in]: Demographic.idsSubquery(
              ProjectReport.approvedIdsSubquery(projectId),
              ProjectReport.LARAVEL_TYPE,
              Demographic.JOBS_TYPE
            )
          }
        }
      })) ?? 0
    );
  }

  async getDashboardProjects(
    query: DashboardQueryDto
  ): Promise<{ data: DashboardProjectsLightDto[]; paginationTotal: number; pageNumber: number }> {
    const projectsBuilder = new DashboardProjectsQueryBuilder(Project, query, [
      {
        association: "organisation",
        attributes: ["uuid", "name", "type"]
      }
    ]).queryFilters(query);

    const [projects, paginationTotal] = await Promise.all([
      projectsBuilder.execute(),
      projectsBuilder.paginationTotal()
    ]);

    const projectsData = await Promise.all(
      projects.map(async project => {
        const approvedSitesQuery = Site.approvedIdsSubquery(project.id);
        const approvedSiteReportsQuery = SiteReport.approvedIdsSubquery(approvedSitesQuery);

        const [totalSites, totalHectaresRestoredSum, treesPlantedCount, totalJobsCreated] = await Promise.all([
          Site.approved().project(project.id).count(),
          SitePolygon.active().approved().sites(Site.approvedUuidsSubquery(project.id)).sum("calcArea") ?? 0,
          TreeSpecies.visible().collection("tree-planted").siteReports(approvedSiteReportsQuery).sum("amount") ?? 0,
          this.getTotalJobs(project.id)
        ]);

        return new DashboardProjectsLightDto(project, {
          totalSites,
          totalHectaresRestoredSum,
          treesPlantedCount,
          totalJobsCreated
        } as HybridSupportProps<DashboardProjectsLightDto, Project>);
      })
    );

    return {
      data: projectsData,
      paginationTotal,
      pageNumber: query.number ?? 1
    };
  }
}

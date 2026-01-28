import { Injectable } from "@nestjs/common";
import {
  Project,
  Site,
  SitePolygon,
  TreeSpecies,
  SiteReport,
  TrackingEntry,
  Tracking,
  ProjectReport
} from "@terramatch-microservices/database/entities";
import { Op } from "sequelize";
import { DashboardQueryDto } from "./dto/dashboard-query.dto";
import { DashboardProjectsQueryBuilder } from "./dashboard-query.builder";
import { DashboardProjectsLightDto } from "./dto/dashboard-projects.dto";
import { HybridSupportProps } from "@terramatch-microservices/common/dto/hybrid-support.dto";
import { PolicyService } from "@terramatch-microservices/common";

@Injectable()
export class DashboardProjectsService {
  constructor(private readonly policyService: PolicyService) {}

  protected async getTotalJobs(projectId: number) {
    return (
      (await TrackingEntry.gender().sum("amount", {
        where: {
          trackingId: {
            [Op.in]: Tracking.demographicIdsSubquery(
              ProjectReport.approvedIdsSubquery(projectId),
              ProjectReport.LARAVEL_TYPE,
              Tracking.JOBS_TYPE
            )
          }
        }
      })) ?? 0
    );
  }

  async getDashboardProjects(query: DashboardQueryDto): Promise<DashboardProjectsLightDto[]> {
    const projectsBuilder = new DashboardProjectsQueryBuilder(Project, [
      {
        association: "organisation",
        attributes: ["uuid", "name", "type"]
      }
    ]).queryFilters(query);

    const projects = await projectsBuilder.execute();

    return await Promise.all(
      projects.map(async project => {
        const approvedSitesQuery = Site.approvedIdsSubquery(project.id);
        const approvedSiteReportsQuery = SiteReport.approvedIdsSubquery(approvedSitesQuery);

        const [totalSites, totalHectaresRestoredSum, treesPlantedCount, totalJobsCreated, hasAccess] =
          await Promise.all([
            Site.approved().project(project.id).count(),
            SitePolygon.active().approved().sites(Site.approvedUuidsSubquery(project.id)).sum("calcArea") ?? 0,
            TreeSpecies.visible().collection("tree-planted").siteReports(approvedSiteReportsQuery).sum("amount") ?? 0,
            this.getTotalJobs(project.id),
            this.policyService.hasAccess("read", project)
          ]);

        return new DashboardProjectsLightDto(project, {
          totalSites,
          totalHectaresRestoredSum,
          treesPlantedCount,
          totalJobsCreated,
          organisationName: project.organisation?.name ?? null,
          organisationType: project.organisation?.type ?? null,
          hasAccess
        } as HybridSupportProps<DashboardProjectsLightDto, Project>);
      })
    );
  }
}

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
import { DashboardEntityProcessor, DtoResult } from "./dashboard-entity-processor";
import { DashboardProjectsLightDto, DashboardProjectsFullDto } from "../dto/dashboard-projects.dto";
import { DashboardQueryDto } from "../dto/dashboard-query.dto";
import { DashboardProjectsQueryBuilder } from "../dashboard-query.builder";
import { Op } from "sequelize";
import { PolicyService } from "@terramatch-microservices/common";
import { CacheService } from "../dto/cache.service";
import { HybridSupportProps } from "@terramatch-microservices/common/dto/hybrid-support.dto";

export class DashboardProjectsProcessor extends DashboardEntityProcessor<
  Project,
  DashboardProjectsLightDto,
  DashboardProjectsFullDto
> {
  readonly LIGHT_DTO = DashboardProjectsLightDto;
  readonly FULL_DTO = DashboardProjectsFullDto;

  constructor(protected readonly cacheService: CacheService, protected readonly policyService: PolicyService) {
    super(cacheService, policyService);
  }

  async findOne(uuid: string): Promise<Project | null> {
    return await Project.findOne({
      where: { uuid },
      include: [
        {
          association: "organisation",
          attributes: ["uuid", "name", "type"]
        }
      ]
    });
  }

  async findMany(query: DashboardQueryDto): Promise<Project[]> {
    const projectsBuilder = new DashboardProjectsQueryBuilder(Project, [
      {
        association: "organisation",
        attributes: ["uuid", "name", "type"]
      }
    ]).queryFilters(query);

    return await projectsBuilder.execute();
  }

  protected async getTotalJobs(projectId: number) {
    return (
      (await TrackingEntry.gender().sum("amount", {
        where: {
          trackingId: {
            [Op.in]: Tracking.idsSubquery(ProjectReport.approvedIdsSubquery(projectId), ProjectReport.LARAVEL_TYPE, {
              domain: "demographics",
              type: Tracking.JOBS_TYPE
            })
          }
        }
      })) ?? 0
    );
  }

  async getLightDto(project: Project): Promise<DtoResult<DashboardProjectsLightDto>> {
    const approvedSitesQuery = Site.approvedIdsSubquery(project.id);
    const approvedSiteReportsQuery = SiteReport.approvedIdsSubquery(approvedSitesQuery);

    const [totalSites, totalHectaresRestoredSum, treesPlantedCount, totalJobsCreated, hasAccess] = await Promise.all([
      Site.approved().project(project.id).count(),
      SitePolygon.active().approved().sites(Site.approvedUuidsSubquery(project.id)).sum("calcArea") ?? 0,
      TreeSpecies.visible().collection("tree-planted").siteReports(approvedSiteReportsQuery).sum("amount") ?? 0,
      this.getTotalJobs(project.id),
      this.policyService.hasAccess("read", project)
    ]);

    const dto = new DashboardProjectsLightDto(project, {
      totalSites,
      totalHectaresRestoredSum,
      treesPlantedCount,
      totalJobsCreated,
      organisationName: project.organisation?.name ?? null,
      organisationType: project.organisation?.type ?? null,
      hasAccess
    } as HybridSupportProps<DashboardProjectsLightDto, Project>);

    return { id: project.uuid, dto };
  }

  async getFullDto(project: Project): Promise<DtoResult<DashboardProjectsFullDto>> {
    const approvedSitesQuery = Site.approvedIdsSubquery(project.id);
    const approvedSiteReportsQuery = SiteReport.approvedIdsSubquery(approvedSitesQuery);

    const [totalSites, totalHectaresRestoredSum, treesPlantedCount, totalJobsCreated, hasAccess] = await Promise.all([
      Site.approved().project(project.id).count(),
      SitePolygon.active().approved().sites(Site.approvedUuidsSubquery(project.id)).sum("calcArea") ?? 0,
      TreeSpecies.visible().collection("tree-planted").siteReports(approvedSiteReportsQuery).sum("amount") ?? 0,
      this.getTotalJobs(project.id),
      this.policyService.hasAccess("read", project)
    ]);

    const fullDto = new DashboardProjectsFullDto(project, {
      totalSites,
      totalHectaresRestoredSum,
      treesPlantedCount,
      totalJobsCreated,
      organisationName: project.organisation?.name ?? null,
      organisationType: project.organisation?.type ?? null,
      hasAccess
    } as HybridSupportProps<DashboardProjectsFullDto, Project>);

    return { id: project.uuid, dto: fullDto };
  }
}

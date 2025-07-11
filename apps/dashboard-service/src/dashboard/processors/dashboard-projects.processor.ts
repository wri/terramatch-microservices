import { Project, Site, SitePolygon, TreeSpecies, SiteReport } from "@terramatch-microservices/database/entities";
import { DashboardEntityProcessor, DtoResult } from "./dashboard-entity-processor";
import { DashboardProjectsLightDto, DashboardProjectsFullDto } from "../dto/dashboard-projects.dto";
import { DashboardQueryDto } from "../dto/dashboard-query.dto";
import { DashboardProjectsQueryBuilder } from "../dashboard-query.builder";

export class DashboardProjectsProcessor extends DashboardEntityProcessor<
  Project,
  DashboardProjectsLightDto,
  DashboardProjectsFullDto
> {
  readonly LIGHT_DTO = DashboardProjectsLightDto;
  readonly FULL_DTO = DashboardProjectsFullDto;

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

  async getLightDto(project: Project): Promise<DtoResult<DashboardProjectsLightDto>> {
    const approvedSitesQuery = Site.approvedIdsSubquery(project.id);
    const approvedSiteReportsQuery = SiteReport.approvedIdsSubquery(approvedSitesQuery);

    const [totalSites, totalHectaresRestoredSum, treesPlantedCount] = await Promise.all([
      Site.approved().project(project.id).count(),
      SitePolygon.active().approved().sites(Site.approvedUuidsSubquery(project.id)).sum("calcArea") ?? 0,
      TreeSpecies.visible().collection("tree-planted").siteReports(approvedSiteReportsQuery).sum("amount") ?? 0
    ]);

    const dto = new DashboardProjectsLightDto({
      uuid: project.uuid,
      country: project.country,
      frameworkKey: project.frameworkKey,
      name: project.name,
      organisationName: project.organisation?.name ?? null,
      treesPlantedCount: treesPlantedCount,
      totalHectaresRestoredSum: totalHectaresRestoredSum,
      lat: project.lat,
      long: project.long,
      organisationType: project.organisation?.type ?? null,
      treesGrownGoal: project.treesGrownGoal,
      totalSites: totalSites
    });

    return { id: project.uuid, dto };
  }

  async getFullDto(project: Project): Promise<DtoResult<DashboardProjectsFullDto>> {
    const { dto: lightDto } = await this.getLightDto(project);

    const fullDto = new DashboardProjectsFullDto({
      ...lightDto
    });

    return { id: project.uuid, dto: fullDto };
  }
}

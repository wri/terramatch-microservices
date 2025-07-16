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
import { DashboardEntityProcessor, DtoResult } from "./dashboard-entity-processor";
import { DashboardProjectsLightDto, DashboardProjectsFullDto } from "../dto/dashboard-projects.dto";
import { DashboardQueryDto, SideloadType } from "../dto/dashboard-query.dto";
import { DashboardProjectsQueryBuilder } from "../dashboard-query.builder";
import { Op } from "sequelize";
import { PolicyService } from "@terramatch-microservices/common";
import { CacheService } from "../dto/cache.service";
import { DocumentBuilder } from "@terramatch-microservices/common/util/json-api-builder";
import { BadRequestException } from "@nestjs/common";

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

  async getLightDto(project: Project): Promise<DtoResult<DashboardProjectsLightDto>> {
    const approvedSitesQuery = Site.approvedIdsSubquery(project.id);
    const approvedSiteReportsQuery = SiteReport.approvedIdsSubquery(approvedSitesQuery);

    const [totalSites, totalHectaresRestoredSum, treesPlantedCount, totalJobsCreated] = await Promise.all([
      Site.approved().project(project.id).count(),
      SitePolygon.active().approved().sites(Site.approvedUuidsSubquery(project.id)).sum("calcArea") ?? 0,
      TreeSpecies.visible().collection("tree-planted").siteReports(approvedSiteReportsQuery).sum("amount") ?? 0,
      this.getTotalJobs(project.id)
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
      totalSites: totalSites,
      is_light: true,
      totalJobsCreated: totalJobsCreated
    });

    return { id: project.uuid, dto };
  }

  async getFullDto(project: Project): Promise<DtoResult<DashboardProjectsFullDto>> {
    const approvedSitesQuery = Site.approvedIdsSubquery(project.id);
    const approvedSiteReportsQuery = SiteReport.approvedIdsSubquery(approvedSitesQuery);

    const [totalSites, totalHectaresRestoredSum, treesPlantedCount, totalJobsCreated] = await Promise.all([
      Site.approved().project(project.id).count(),
      SitePolygon.active().approved().sites(Site.approvedUuidsSubquery(project.id)).sum("calcArea") ?? 0,
      TreeSpecies.visible().collection("tree-planted").siteReports(approvedSiteReportsQuery).sum("amount") ?? 0,
      this.getTotalJobs(project.id)
    ]);

    const fullDto = new DashboardProjectsFullDto({
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
      totalSites: totalSites,
      is_light: false,
      totalJobsCreated: totalJobsCreated,
      cohort: project.cohort,
      objectives: project.objectives ?? null,
      landTenureProjectArea: project.landTenureProjectArea
    });

    return { id: project.uuid, dto: fullDto };
  }

  async processSideload(
    document: DocumentBuilder,
    model: Project,
    entity: SideloadType,
    pageSize: number
  ): Promise<void> {
    if (!["sitePolygons", "demographics"].includes(entity)) {
      throw new BadRequestException("Projects only support sideloading sitePolygons and demographics");
    }

    // For now, we'll use a simplified approach that follows the entity service pattern
    // but adapted for dashboard-specific needs
    if (entity === "sitePolygons") {
      await this.processSitePolygonsSideload(document, model, pageSize);
    }

    if (entity === "demographics") {
      await this.processDemographicsSideload(document, model, pageSize);
    }
  }

  private async processSitePolygonsSideload(
    document: DocumentBuilder,
    project: Project,
    pageSize: number
  ): Promise<void> {
    const cacheKey = `dashboard:sitePolygons:${project.uuid}:${pageSize}`;

    const sitePolygons = await this.cacheService.get(cacheKey, async () => {
      const approvedSitesQuery = Site.approvedIdsSubquery(project.id);

      return await SitePolygon.active()
        .approved()
        .sites(Site.approvedUuidsSubquery(project.id))
        .findAll({
          include: [
            {
              association: "site",
              attributes: ["uuid", "name"],
              include: [
                {
                  association: "project",
                  attributes: ["uuid", "name"]
                }
              ]
            }
          ],
          attributes: [
            "uuid",
            "polyName",
            "status",
            "siteUuid",
            "plantStart",
            "calcArea",
            "lat",
            "long",
            "practice",
            "targetSys",
            "distr",
            "numTrees",
            "versionName",
            "plantingStatus"
          ],
          limit: pageSize,
          order: [["createdAt", "DESC"]]
        });
    });

    // Import the DTOs dynamically to avoid circular dependencies
    const { DashboardSitePolygonDto } = await import("../dto/dashboard-site-polygon.dto");

    for (const polygon of sitePolygons) {
      const dto = new DashboardSitePolygonDto({
        uuid: polygon.uuid,
        polyName: polygon.polyName,
        status: polygon.status,
        siteUuid: polygon.siteUuid,
        siteName: polygon.site?.name ?? null,
        projectUuid: polygon.site?.project?.uuid ?? null,
        projectName: polygon.site?.project?.name ?? null,
        plantStart: polygon.plantStart,
        calcArea: polygon.calcArea,
        lat: polygon.lat,
        long: polygon.long,
        practice: polygon.practice,
        targetSys: polygon.targetSys,
        distr: polygon.distr,
        numTrees: polygon.numTrees,
        versionName: polygon.versionName,
        plantingStatus: polygon.plantingStatus
      });

      document.addData(polygon.uuid, dto);
    }
  }

  private async processDemographicsSideload(
    document: DocumentBuilder,
    project: Project,
    pageSize: number
  ): Promise<void> {
    const cacheKey = `dashboard:demographics:${project.uuid}:${pageSize}`;

    const demographics = await this.cacheService.get(cacheKey, async () => {
      return await Demographic.findAll({
        where: {
          demographicalType: Project.LARAVEL_TYPE,
          demographicalId: project.id,
          hidden: false
        },
        include: [
          {
            association: "entries",
            attributes: ["type", "subtype", "name", "amount"]
          }
        ],
        limit: pageSize,
        order: [["createdAt", "DESC"]]
      });
    });

    // Import the DTOs dynamically to avoid circular dependencies
    const { DashboardDemographicDto, DashboardDemographicEntryDto } = await import("../dto/dashboard-demographic.dto");

    for (const demographic of demographics) {
      const dto = new DashboardDemographicDto({
        uuid: demographic.uuid,
        type: demographic.type,
        collection: demographic.collection,
        description: demographic.description,
        projectUuid: project.uuid,
        projectName: project.name,
        entries:
          demographic.entries?.map(
            entry =>
              new DashboardDemographicEntryDto({
                type: entry.type,
                subtype: entry.subtype,
                name: entry.name,
                amount: entry.amount
              })
          ) ?? []
      });

      document.addData(demographic.uuid, dto);
    }
  }
}

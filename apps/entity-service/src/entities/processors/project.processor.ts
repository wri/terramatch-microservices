import { DocumentBuilder } from "@terramatch-microservices/common/util";
import { Aggregate, aggregateColumns, EntityProcessor } from "./entity-processor";
import {
  Demographic,
  DemographicEntry,
  Media,
  Nursery,
  NurseryReport,
  Project,
  ProjectReport,
  ProjectUser,
  Seeding,
  Site,
  SitePolygon,
  SiteReport,
  TreeSpecies
} from "@terramatch-microservices/database/entities";
import { Dictionary, groupBy, sumBy } from "lodash";
import { Op } from "sequelize";
import {
  AdditionalProjectFullProps,
  ANRDto,
  ProjectApplicationDto,
  ProjectFullDto,
  ProjectLightDto,
  ProjectMedia
} from "../dto/project.dto";
import { EntityQueryDto } from "../dto/entity-query.dto";
import { FrameworkKey } from "@terramatch-microservices/database/constants/framework";
import { BadRequestException } from "@nestjs/common";

export class ProjectProcessor extends EntityProcessor<Project, ProjectLightDto, ProjectFullDto> {
  readonly LIGHT_DTO = ProjectLightDto;
  readonly FULL_DTO = ProjectFullDto;

  async findOne(uuid: string) {
    return await Project.findOne({
      where: { uuid },
      include: [
        { association: "framework" },
        { association: "organisation", attributes: ["name"] },
        {
          association: "application",
          include: [{ association: "fundingProgramme" }, { association: "formSubmissions" }]
        }
      ]
    });
  }

  async findMany(query: EntityQueryDto, userId: number, permissions: string[]) {
    const builder = await this.entitiesService.buildQuery(Project, query, [
      { association: "organisation", attributes: ["name"] },
      { association: "framework" }
    ]);

    if (query.sort != null) {
      if (["name", "plantingStartDate", "country"].includes(query.sort.field)) {
        builder.order([query.sort.field, query.sort.direction ?? "ASC"]);
      } else if (query.sort.field === "organisationName") {
        builder.order(["organisation", "name", query.sort.direction ?? "ASC"]);
      } else if (query.sort.field !== "id") {
        throw new BadRequestException(`Invalid sort field: ${query.sort.field}`);
      }
    }

    const frameworkPermissions = permissions
      .filter(name => name.startsWith("framework-"))
      .map(name => name.substring("framework-".length) as FrameworkKey);
    if (frameworkPermissions.length > 0) {
      builder.where({ frameworkKey: { [Op.in]: frameworkPermissions } });
    } else if (permissions.includes("manage-own")) {
      builder.where({ id: { [Op.in]: ProjectUser.userProjectsSubquery(userId) } });
    } else if (permissions.includes("projects-manage")) {
      builder.where({ id: { [Op.in]: ProjectUser.projectsManageSubquery(userId) } });
    }

    for (const term of ["country", "status", "updateRequestStatus", "frameworkKey"]) {
      if (query[term] != null) builder.where({ [term]: query[term] });
    }
    if (query.search != null) {
      builder.where({ name: { [Op.like]: `%${query.search}%` } });
    }

    return { models: await builder.execute(), paginationTotal: await builder.paginationTotal() };
  }

  async addLightDto(document: DocumentBuilder, project: Project) {
    const projectId = project.id;
    const totalHectaresRestoredSum =
      (await SitePolygon.active().approved().sites(Site.approvedUuidsSubquery(projectId)).sum("calcArea")) ?? 0;
    document.addData(project.uuid, new ProjectLightDto(project, { totalHectaresRestoredSum }));
  }

  async addFullDto(document: DocumentBuilder, project: Project) {
    const projectId = project.id;
    const approvedSitesQuery = Site.approvedIdsSubquery(projectId);
    const approvedSiteReportsQuery = SiteReport.approvedIdsSubquery(approvedSitesQuery);

    const approvedSites = await Site.approved()
      .project(projectId)
      .findAll({ attributes: ["id", "name"] });

    const approvedSiteReports =
      approvedSites.length === 0
        ? ([] as unknown as Dictionary<SiteReport[]>)
        : groupBy(
            await SiteReport.approved()
              .sites(approvedSitesQuery)
              .findAll({ attributes: ["id", "siteId", "numTreesRegenerating"] }),
            "siteId"
          );

    const assistedNaturalRegenerationList: ANRDto[] = approvedSites.map(({ id, name }) => ({
      name,
      treeCount: sumBy(approvedSiteReports[id], "numTreesRegenerating") ?? 0
    }));
    const regeneratedTreesCount = sumBy(assistedNaturalRegenerationList, "treeCount");
    const treesPlantedCount =
      (await TreeSpecies.visible().collection("tree-planted").siteReports(approvedSiteReportsQuery).sum("amount")) ?? 0;
    const seedsPlantedCount = (await Seeding.visible().siteReports(approvedSiteReportsQuery).sum("amount")) ?? 0;

    const props: AdditionalProjectFullProps = {
      totalSites: approvedSites.length,
      totalNurseries: await Nursery.approved().project(projectId).count(),
      totalOverdueReports: await this.getTotalOverdueReports(project.id),
      totalProjectReports: await ProjectReport.project(projectId).count(),

      assistedNaturalRegenerationList,
      regeneratedTreesCount,
      treesPlantedCount,
      seedsPlantedCount,
      treesRestoredPpc:
        regeneratedTreesCount +
        (treesPlantedCount * ((project.survivalRate ?? 0) / 100) +
          (seedsPlantedCount * (project.directSeedingSurvivalRate ?? 0)) / 100),

      totalHectaresRestoredSum:
        (await SitePolygon.active().approved().sites(Site.approvedUuidsSubquery(projectId)).sum("calcArea")) ?? 0,

      workdayCount: await this.getWorkdayCount(project.id),
      selfReportedWorkdayCount: await this.getSelfReportedWorkdayCount(project.id),
      combinedWorkdayCount:
        (await this.getWorkdayCount(project.id, true)) + (await this.getSelfReportedWorkdayCount(project.id, true)),
      totalJobsCreated: await this.getTotalJobs(project.id),

      application: project.application == null ? null : new ProjectApplicationDto(project.application),

      ...(this.entitiesService.mapMediaCollection(
        await Media.project(project.id).findAll(),
        Project.MEDIA
      ) as ProjectMedia)
    };

    document.addData(project.uuid, new ProjectFullDto(project, props));
  }

  protected async getWorkdayCount(projectId: number, useDemographicsCutoff = false) {
    const dueAfter = useDemographicsCutoff ? Demographic.DEMOGRAPHIC_COUNT_CUTOFF : undefined;

    const siteIds = Site.approvedIdsSubquery(projectId);
    const siteReportIds = SiteReport.approvedIdsSubquery(siteIds, { dueAfter });
    const siteReportWorkdays = Demographic.idsSubquery(
      siteReportIds,
      SiteReport.LARAVEL_TYPE,
      Demographic.WORKDAYS_TYPE
    );
    const projectReportIds = ProjectReport.approvedIdsSubquery(projectId, { dueAfter });
    const projectReportWorkdays = Demographic.idsSubquery(
      projectReportIds,
      ProjectReport.LARAVEL_TYPE,
      Demographic.WORKDAYS_TYPE
    );

    return (
      (await DemographicEntry.gender().sum("amount", {
        where: {
          demographicId: {
            [Op.or]: [{ [Op.in]: siteReportWorkdays }, { [Op.in]: projectReportWorkdays }]
          }
        }
      })) ?? 0
    );
  }

  protected async getSelfReportedWorkdayCount(projectId: number, useDemographicsCutoff = false) {
    let SR = SiteReport.approved().sites(Site.approvedIdsSubquery(projectId));
    let PR = ProjectReport.approved().project(projectId);
    if (useDemographicsCutoff) {
      PR = PR.dueBefore(Demographic.DEMOGRAPHIC_COUNT_CUTOFF);
      SR = SR.dueBefore(Demographic.DEMOGRAPHIC_COUNT_CUTOFF);
    }

    const aggregates = [
      { func: "SUM", attr: "workdaysPaid" },
      { func: "SUM", attr: "workdaysVolunteer" }
    ];
    const site = await aggregateColumns(SR, aggregates as Aggregate<SiteReport>[]);
    const project = await aggregateColumns(PR, aggregates as Aggregate<ProjectReport>[]);
    return site.workdaysPaid + site.workdaysVolunteer + project.workdaysPaid + project.workdaysVolunteer;
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

  protected async getTotalOverdueReports(projectId: number) {
    const countOpts = { where: { dueAt: { [Op.lt]: new Date() } } };
    const pTotal = await ProjectReport.incomplete().project(projectId).count(countOpts);
    const sTotal = await SiteReport.incomplete().sites(Site.approvedIdsSubquery(projectId)).count(countOpts);
    const nTotal = await NurseryReport.incomplete().nurseries(Nursery.approvedIdsSubquery(projectId)).count(countOpts);

    return pTotal + sTotal + nTotal;
  }
}

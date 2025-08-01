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
import { Op, Sequelize } from "sequelize";
import { ANRDto, ProjectApplicationDto, ProjectFullDto, ProjectLightDto, ProjectMedia } from "../dto/project.dto";
import { EntityQueryDto } from "../dto/entity-query.dto";
import { FrameworkKey } from "@terramatch-microservices/database/constants/framework";
import { BadRequestException, UnauthorizedException, InternalServerErrorException } from "@nestjs/common";
import { ProcessableEntity } from "../entities.service";
import { DocumentBuilder } from "@terramatch-microservices/common/util";
import { ProjectUpdateAttributes } from "../dto/entity-update.dto";
import { populateDto } from "@terramatch-microservices/common/dto/json-api-attributes";
import { EntityDto } from "../dto/entity.dto";
import { mapLandscapeCodesToNames } from "@terramatch-microservices/database/constants";

const SIMPLE_FILTERS: (keyof EntityQueryDto)[] = [
  "country",
  "status",
  "updateRequestStatus",
  "frameworkKey",
  "projectUuid",
  "organisationUuid"
];

const ASSOCIATION_FIELD_MAP = {
  projectUuid: "uuid",
  organisationUuid: "$organisation.uuid$",
  organisationType: "$organisation.type$"
};

export class ProjectProcessor extends EntityProcessor<
  Project,
  ProjectLightDto,
  ProjectFullDto,
  ProjectUpdateAttributes
> {
  readonly LIGHT_DTO = ProjectLightDto;
  readonly FULL_DTO = ProjectFullDto;

  get sql() {
    if (Project.sequelize == null) throw new InternalServerErrorException("Model is missing sequelize connection");
    return Project.sequelize;
  }

  async findOne(uuid: string) {
    return await Project.findOne({
      where: { uuid },
      include: [
        { association: "organisation", attributes: ["uuid", "name", "type"] },
        {
          association: "application",
          include: [{ association: "fundingProgramme" }, { association: "formSubmissions" }]
        }
      ]
    });
  }

  async findMany(query: EntityQueryDto) {
    const builder = await this.entitiesService.buildQuery(Project, query, [
      { association: "organisation", attributes: ["uuid", "name", "type"] }
    ]);

    if (query.sort?.field != null) {
      if (["name", "plantingStartDate", "country", "shortName"].includes(query.sort.field)) {
        builder.order([query.sort.field, query.sort.direction ?? "ASC"]);
      } else if (query.sort.field === "organisationName") {
        builder.order(["organisation", "name", query.sort.direction ?? "ASC"]);
      } else if (query.sort.field !== "id") {
        throw new BadRequestException(`Invalid sort field: ${query.sort.field}`);
      }
    }

    const permissions = await this.entitiesService.getPermissions();
    const frameworkPermissions = permissions
      .filter(name => name.startsWith("framework-"))
      .map(name => name.substring("framework-".length) as FrameworkKey);
    if (frameworkPermissions.length > 0) {
      builder.where({ frameworkKey: { [Op.in]: frameworkPermissions } });
    } else if (permissions.includes("manage-own")) {
      builder.where({ id: { [Op.in]: ProjectUser.userProjectsSubquery(this.entitiesService.userId) } });
    } else if (permissions.includes("projects-manage")) {
      builder.where({ id: { [Op.in]: ProjectUser.projectsManageSubquery(this.entitiesService.userId) } });
    }

    for (const term of SIMPLE_FILTERS) {
      const field = ASSOCIATION_FIELD_MAP[term] ?? term;
      if (query[term] != null) builder.where({ [field]: query[term] });
    }

    if (query.landscape != null && query.landscape.length > 0) {
      const landscapeNames = mapLandscapeCodesToNames(query.landscape);
      builder.where({ landscape: { [Op.in]: landscapeNames } });
    }

    if (query.organisationType != null && query.organisationType.length > 0) {
      builder.where({ "$organisation.type$": { [Op.in]: query.organisationType } });
    }

    if (query.cohort != null && query.cohort.length > 0) {
      const cohortConditions = query.cohort
        .map(cohort => `JSON_CONTAINS(cohort, ${this.sql.escape(`"${cohort}"`)})`)
        .join(" OR ");
      builder.where(Sequelize.literal(`(${cohortConditions})`));
    }

    if (query.shortName != null) {
      builder.where({ shortName: query.shortName });
    }

    if (query.search != null || query.searchFilter != null) {
      builder.where({ name: { [Op.like]: `%${query.search ?? query.searchFilter}%` } });
    }

    return { models: await builder.execute(), paginationTotal: await builder.paginationTotal() };
  }

  async update(project: Project, update: ProjectUpdateAttributes) {
    if (update.isTest != null) {
      if (!(await this.entitiesService.isFrameworkAdmin(project))) {
        // Only framework admins can set the isTest flag.
        throw new UnauthorizedException();
      }

      project.isTest = update.isTest;
    }

    await super.update(project, update);
  }

  async processSideload(
    document: DocumentBuilder,
    model: Project,
    entity: ProcessableEntity,
    pageSize: number
  ): Promise<void> {
    if (!["sites", "nurseries"].includes(entity)) {
      throw new BadRequestException("Projects only support sideloading associated sites and nurseries");
    }
    const processor = this.entitiesService.createEntityProcessor(entity);
    await processor.addIndex(document, { page: { size: pageSize }, projectUuid: model.uuid }, true);
  }

  async getLightDto(project: Project, associateDto: EntityDto) {
    const projectId = project.id;
    const totalHectaresRestoredSum =
      (await SitePolygon.active().approved().sites(Site.approvedUuidsSubquery(projectId)).sum("calcArea")) ?? 0;

    return {
      id: project.uuid,
      dto: new ProjectLightDto(project, {
        totalHectaresRestoredSum,
        treesPlantedCount: 0,
        ...associateDto
      })
    };
  }

  async getFullDto(project: Project) {
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

    const dto = new ProjectFullDto(project, {
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

      application: project.application == null ? null : populateDto(new ProjectApplicationDto(), project.application),

      ...(this.entitiesService.mapMediaCollection(
        await Media.for(project).findAll(),
        Project.MEDIA,
        "projects",
        project.uuid
      ) as ProjectMedia)
    });

    return { id: project.uuid, dto };
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
    return (
      (site.workdaysPaid ?? 0) +
      (site.workdaysVolunteer ?? 0) +
      (project.workdaysPaid ?? 0) +
      (project.workdaysVolunteer ?? 0)
    );
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

  /* istanbul ignore next */
  async loadAssociationData(projectIds: number[]): Promise<Record<number, ProjectLightDto>> {
    const associationDtos: Record<number, ProjectLightDto> = {};
    const sites = await this.getSites(projectIds);

    if (sites.length === 0) {
      return associationDtos;
    }

    const siteIdToProjectId = new Map<number, number>();
    for (const site of sites) {
      siteIdToProjectId.set(site.id, site.projectId);
      if (associationDtos[site.projectId] !== undefined) {
        associationDtos[site.projectId] = {} as ProjectLightDto; // Initialize with default structure
      }
    }

    const approvedSiteReports = await this.getSiteReports(sites);

    if (approvedSiteReports.length === 0) {
      return associationDtos;
    }

    const siteReportIdToProjectId = new Map<number, number>();
    for (const report of approvedSiteReports) {
      const projectId = siteIdToProjectId.get(report.siteId) ?? null;
      if (projectId !== null) {
        siteReportIdToProjectId.set(report.id, projectId);
      }
    }
    const treeSpecies = await this.getTreeSpecies(approvedSiteReports);

    for (const species of treeSpecies) {
      const projectId = siteReportIdToProjectId.get(species.speciesableId);
      if (projectId !== undefined) {
        const dto = associationDtos[projectId] as ProjectLightDto;

        if (dto == null) {
          associationDtos[projectId] = { treesPlantedCount: species.amount } as ProjectLightDto;
        } else {
          dto.treesPlantedCount = (dto.treesPlantedCount ?? 0) + (species.amount ?? 0);
        }
      }
    }

    return associationDtos;
  }

  /* istanbul ignore next */
  private async getTreeSpecies(approvedSiteReports: SiteReport[]) {
    return await TreeSpecies.visible()
      .collection("tree-planted")
      .siteReports(approvedSiteReports.map(r => r.id))
      .findAll({
        attributes: ["speciesableId", [Sequelize.fn("SUM", Sequelize.col("amount")), "amount"]],
        group: ["speciesableId"],
        raw: true
      });
  }

  /* istanbul ignore next */
  private async getSiteReports(sites: Site[]) {
    return await SiteReport.findAll({
      where: { id: { [Op.in]: SiteReport.approvedIdsSubquery(sites.map(s => s.id)) } },
      attributes: ["id", "siteId"],
      raw: true
    });
  }

  /* istanbul ignore next */
  private async getSites(numericProjectIds: number[]) {
    return await Site.findAll({
      where: { id: { [Op.in]: Site.approvedIdsProjectsSubquery(numericProjectIds) } },
      attributes: ["id", "projectId"],
      raw: true
    });
  }
}

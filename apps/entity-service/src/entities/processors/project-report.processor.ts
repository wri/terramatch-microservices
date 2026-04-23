import { ProjectReport } from "@terramatch-microservices/database/entities/project-report.entity";
import { ExportAllOptions, ReportProcessor } from "./entity-processor";
import { ProjectReportFullDto, ProjectReportLightDto, ProjectReportMedia } from "../dto/project-report.dto";
import { EntityQueryDto, SideloadType } from "../dto/entity-query.dto";
import { Includeable, Op, WhereOptions } from "sequelize";
import { BadRequestException } from "@nestjs/common";
import { FrameworkKey } from "@terramatch-microservices/database/constants/framework";
import {
  Media,
  NurseryReport,
  Project,
  ProjectUser,
  Seeding,
  SiteReport,
  Tracking,
  TrackingEntry,
  TreeSpecies
} from "@terramatch-microservices/database/entities";
import { ProcessableAssociation } from "../entities.service";
import { DocumentBuilder } from "@terramatch-microservices/common/util";
import { ReportUpdateAttributes } from "../dto/entity-update.dto";
import { Literal } from "sequelize/types/utils";
import {
  DIRECT_OTHER,
  INDIRECT_OTHER,
  PAID_OTHER,
  VOLUNTEER_OTHER
} from "@terramatch-microservices/database/constants/demographic-collections";
import { Dictionary } from "lodash";
import { PaginatedQueryBuilder } from "@terramatch-microservices/common/util/paginated-query.builder";
import { Subquery } from "@terramatch-microservices/database/util/subquery.builder";

const SUPPORTED_ASSOCIATIONS: ProcessableAssociation[] = ["trackings", "seedings", "treeSpecies"];

const SIMPLE_FILTERS: (keyof EntityQueryDto)[] = [
  "status",
  "updateRequestStatus",
  "frameworkKey",
  "organisationUuid",
  "country",
  "projectUuid"
];

const ASSOCIATION_FIELD_MAP = {
  organisationUuid: "$project.organisation.uuid$",
  country: "$project.country$",
  projectUuid: "$project.uuid$"
};

function resolvePlantingStatus(
  plantingStatus: string | null | undefined,
  landscapeCommunityContribution: string | null | undefined,
  communityProgress: string | null | undefined
) {
  if (plantingStatus != null) return plantingStatus;

  const candidate = landscapeCommunityContribution ?? communityProgress;
  if (candidate == null) return null;
  const normalized = candidate.trim().toLowerCase();
  if (["yes", "true", "completed"].includes(normalized)) return "completed";
  return null;
}

const CSV_COLUMNS: Dictionary<string> = {
  id: "id",
  uuid: "uuid",
  organisationReadableType: "organization-readable_type",
  organisationName: "organization-name",
  projectName: "project_name",
  status: "status",
  updateRequestStatus: "update_request_status",
  dueAt: "due_date",
  createdAt: "created_at",
  updatedAt: "updated_at",
  projectExportId: "project_id",
  projectUuid: "project_uuid"
};

const CSV_ATTRIBUTES = ["id", "uuid", "projectId", "status", "updateRequestStatus", "createdAt", "updatedAt", "dueAt"];

export class ProjectReportProcessor extends ReportProcessor<
  ProjectReport,
  ProjectReportLightDto,
  ProjectReportFullDto,
  ReportUpdateAttributes
> {
  readonly LIGHT_DTO = ProjectReportLightDto;
  readonly FULL_DTO = ProjectReportFullDto;

  async findOne(uuid: string) {
    return await ProjectReport.findOne({
      where: { uuid },
      include: [
        {
          association: "project",
          attributes: ["uuid", "name", "country"],
          include: [{ association: "organisation", attributes: ["uuid", "name"] }]
        },
        { association: "user", attributes: ["uuid", "firstName", "lastName"] },
        { association: "createdByUser", attributes: ["id", "uuid", "firstName", "lastName"] },
        { association: "task", attributes: ["uuid"] }
      ]
    });
  }

  async findMany(query: EntityQueryDto) {
    const projectAssociation: Includeable = {
      association: "project",
      attributes: ["uuid", "name"],
      include: [{ association: "organisation", attributes: ["uuid", "name"] }]
    };
    const associations = [projectAssociation];
    const builder = await this.entitiesService.buildQuery(ProjectReport, query, associations);
    if (query.sort?.field != null) {
      if (
        ["title", "status", "updateRequestStatus", "createdAt", "dueAt", "updatedAt", "submittedAt"].includes(
          query.sort.field
        )
      ) {
        builder.order([[query.sort.field, query.sort.direction ?? "ASC"]]);
      } else if (query.sort.field === "projectName") {
        builder.order([["project", "name", query.sort.direction ?? "ASC"]]);
      } else if (query.sort.field === "organisationName") {
        builder.order([["project", "organisation", "name", query.sort.direction ?? "ASC"]]);
      } else if (query.sort.field !== "id") {
        throw new BadRequestException(`Invalid sort field: ${query.sort.field}`);
      }
    }

    const permissions = await this.entitiesService.getPermissions();
    const frameworkPermissions =
      permissions
        ?.filter(name => name.startsWith("framework-"))
        .map(name => name.substring("framework-".length) as FrameworkKey) ?? [];
    if (frameworkPermissions.length > 0) {
      builder.where({ frameworkKey: { [Op.in]: frameworkPermissions } });
    } else if (permissions?.includes("manage-own")) {
      builder.where({
        projectId: { [Op.in]: ProjectUser.userProjectsSubquery(this.entitiesService.userId as number) }
      });
    } else if (permissions?.includes("projects-manage")) {
      builder.where({
        projectId: { [Op.in]: ProjectUser.projectsManageSubquery(this.entitiesService.userId as number) }
      });
    }

    for (const term of SIMPLE_FILTERS) {
      if (query[term] != null) {
        const field = ASSOCIATION_FIELD_MAP[term] ?? term;
        builder.where({ [field]: query[term] });
      }
    }

    if (query.taskId != null) {
      builder.where({ taskId: query.taskId });
    }

    if (query.search != null) {
      builder.where({
        [Op.or]: [
          { title: { [Op.like]: `%${query.search}%` } },
          { "$project.name$": { [Op.like]: `%${query.search}%` } },
          { "$project.organisation.name$": { [Op.like]: `%${query.search}%` } }
        ]
      });
    }

    if (query.projectUuid != null) {
      const project = await Project.findOne({ where: { uuid: query.projectUuid }, attributes: ["id"] });
      if (project == null) {
        throw new BadRequestException(`Project with uuid ${query.projectUuid} not found`);
      }
      builder.where({ projectId: project.id });
    }

    return { models: await builder.execute(), paginationTotal: await builder.paginationTotal() };
  }

  async processSideload(document: DocumentBuilder, model: ProjectReport, entity: SideloadType): Promise<void> {
    if (SUPPORTED_ASSOCIATIONS.includes(entity as ProcessableAssociation)) {
      const processor = this.entitiesService.createAssociationProcessor(
        "projectReports",
        model.uuid,
        entity as ProcessableAssociation
      );
      await processor.addDtos(document);
    } else {
      throw new BadRequestException(`Project reports only support sideloading: ${SUPPORTED_ASSOCIATIONS.join(", ")}`);
    }
  }

  async getFullDto(projectReport: ProjectReport) {
    const reportTitle = await this.getReportTitle(projectReport);
    const landscapeCommunityContribution =
      projectReport.landscapeCommunityContribution ?? projectReport.communityProgress ?? null;
    const plantingStatus = resolvePlantingStatus(
      projectReport.plantingStatus,
      projectReport.landscapeCommunityContribution,
      projectReport.communityProgress
    );

    const dto = new ProjectReportFullDto(projectReport, {
      ...(await this.getFeedback(projectReport)),
      ...(await this.getTaskDependentAggregates(projectReport.id, projectReport.taskId)),
      ...(await this.getDemographicDescriptions(projectReport)),
      reportTitle,
      seedlingsGrown: await this.getSeedlingsGrown(projectReport),
      ...(this.entitiesService.mapMediaCollection(
        await Media.for(projectReport).findAll(),
        ProjectReport.MEDIA,
        "projectReports",
        projectReport.uuid
      ) as ProjectReportMedia)
    });
    dto.landscapeCommunityContribution = landscapeCommunityContribution;
    dto.plantingStatus = plantingStatus;

    await this.entitiesService.removeHiddenValues(projectReport, dto);
    // Keep overview compatibility for consumers that still read landscapeCommunityContribution.
    if (dto.landscapeCommunityContribution == null && projectReport.communityProgress != null) {
      dto.landscapeCommunityContribution = projectReport.communityProgress;
    }
    if (dto.plantingStatus == null) {
      dto.plantingStatus = resolvePlantingStatus(
        projectReport.plantingStatus,
        projectReport.landscapeCommunityContribution,
        projectReport.communityProgress
      );
    }
    if (dto.landscapeCommunityContribution == null && dto.plantingStatus === "completed") {
      dto.landscapeCommunityContribution = "completed";
    }

    return { id: projectReport.uuid, dto };
  }

  async getTaskDependentAggregates(projectReportId: number, taskId: number | null) {
    if (taskId == null) {
      return {
        seedsPlantedCount: 0,
        treesPlantedCount: 0,
        regeneratedTreesCount: 0,
        treesRegeneratingSpeciesCount: 0,
        nonTreeTotal: 0,
        taskTotalWorkdays: 0,
        siteReportsCount: 0,
        nurseryReportsCount: 0
      };
    }

    const siteReportsIdsTask = SiteReport.approvedIdsForTaskSubquery(taskId);
    return {
      seedsPlantedCount: (await Seeding.visible().siteReports(siteReportsIdsTask).sum("amount")) ?? 0,
      treesPlantedCount:
        (await TreeSpecies.visible().collection("tree-planted").siteReports(siteReportsIdsTask).sum("amount")) ?? 0,
      regeneratedTreesCount: await SiteReport.approved().task(taskId).sum("numTreesRegenerating"),
      treesRegeneratingSpeciesCount:
        (await TreeSpecies.visible().collection("anr").siteReports(siteReportsIdsTask).sum("amount")) ?? 0,
      nonTreeTotal: (await Seeding.visible().siteReports(siteReportsIdsTask).sum("amount")) ?? 0,
      taskTotalWorkdays: await this.getTaskTotalWorkdays(projectReportId, siteReportsIdsTask),
      siteReportsCount: await SiteReport.task(taskId).count(),
      nurseryReportsCount: await NurseryReport.task(taskId).count()
    };
  }

  async getLightDto(projectReport: ProjectReport) {
    return { id: projectReport.uuid, dto: new ProjectReportLightDto(projectReport) };
  }

  async exportAll({ response, frameworkKey }: ExportAllOptions = {}) {
    const columns = {
      ...CSV_COLUMNS,
      ...(frameworkKey === "ppc"
        ? { totalSeedlingsGrownReport: "total_seedlings_grown_report", totalSeedlingsGrown: "total_seedlings_grown" }
        : {})
    };

    const additionalDataForPage =
      frameworkKey === "ppc"
        ? async (page: ProjectReport[]) =>
            (
              await Promise.all(
                page.map(async ({ id, projectId, createdAt }) => {
                  // PPC requires two values that are more efficient to get with two SQL queries per
                  // row than by pulling all tree species records and doing it in memory.
                  const totalSeedlingsGrownReport = await TreeSpecies.projectReports([id]).visible().sum("amount");
                  const previousReports = Subquery.select(ProjectReport, "id")
                    .eq("projectId", projectId)
                    .lt("createdAt", createdAt).literal;
                  const previousSum = await TreeSpecies.projectReports(previousReports).visible().sum("amount");
                  const totalSeedlingsGrown =
                    totalSeedlingsGrownReport == null ? previousSum : totalSeedlingsGrownReport + previousSum;
                  return { id, totalSeedlingsGrownReport, totalSeedlingsGrown };
                })
              )
            ).reduce(
              (acc, { id, ...rest }) => ({ ...acc, [id]: rest }),
              {} as Record<
                number,
                { totalSeedlingsGrownReport: number | undefined | null; totalSeedlingsGrown: number | undefined | null }
              >
            )
        : undefined;

    const permissions = await this.entitiesService.getPermissions();
    const where: WhereOptions<ProjectReport> = { "$project.is_test$": false, frameworkKey };
    if (permissions?.includes("manage-own")) {
      where["projectId"] = { [Op.in]: ProjectUser.userProjectsSubquery(this.entitiesService.userId as number) };
    } else if (permissions?.includes("projects-manage")) {
      where["projectId"] = { [Op.in]: ProjectUser.projectsManageSubquery(this.entitiesService.userId as number) };
    }

    await this.entitiesService.entityFrameworkExport(
      "projectReports",
      columns,
      CSV_ATTRIBUTES,
      new PaginatedQueryBuilder(ProjectReport, 10, [
        {
          association: "project",
          attributes: ["name", "id", "uuid", "ppcExternalId"],
          include: [{ association: "organisation", attributes: ["name", "type"] }]
        }
      ]).where(where),
      { response, frameworkKey, additionalDataForPage, ability: response == null ? undefined : "read" }
    );
  }

  protected async getReportTitle(projectReport: ProjectReport) {
    if (projectReport.frameworkKey == "ppc" || projectReport.dueAt == null) {
      return projectReport.title ?? "";
    } else {
      const dueAt = new Date(projectReport.dueAt);
      dueAt.setMonth(dueAt.getMonth() - 1);
      const wEnd = dueAt.toLocaleString(projectReport.user?.locale ?? "en-GB", { month: "long", year: "numeric" });

      dueAt.setMonth(dueAt.getMonth() - 5);
      const wStart = dueAt.toLocaleString(projectReport.user?.locale ?? "en-GB", { month: "long" });

      return `Project Report for ${wStart} - ${wEnd}`;
    }
  }

  protected async getSeedlingsGrown(projectReport: ProjectReport) {
    if (projectReport.frameworkKey == "ppc") {
      return (
        (await TreeSpecies.visible().collection("tree-planted").projectReports([projectReport.id]).sum("amount")) ?? 0
      );
    }

    if (projectReport.frameworkKey == "terrafund" && projectReport.taskId != null) {
      return (await NurseryReport.task(projectReport.taskId).sum("seedlingsYoungTrees")) ?? 0;
    }

    return 0;
  }

  protected async getTaskTotalWorkdays(projectReportId: number, siteIds: Literal) {
    const projectReportDemographics = Tracking.idsSubquery([projectReportId], ProjectReport.LARAVEL_TYPE, {
      domain: "demographics",
      type: Tracking.WORKDAYS_TYPE
    });
    const siteReportDemographics = Tracking.idsSubquery(siteIds, SiteReport.LARAVEL_TYPE, {
      domain: "demographics",
      type: Tracking.WORKDAYS_TYPE
    });
    return (
      (await TrackingEntry.gender().sum("amount", {
        where: {
          trackingId: {
            [Op.or]: [{ [Op.in]: projectReportDemographics }, { [Op.in]: siteReportDemographics }]
          }
        }
      })) ?? 0
    );
  }

  protected async getDemographicDescriptions(projectReport: ProjectReport) {
    const demographics = await Tracking.for(projectReport)
      .domain("demographics")
      .findAll({
        where: {
          description: { [Op.not]: null },
          [Op.or]: [
            { type: Tracking.WORKDAYS_TYPE, collection: [PAID_OTHER, VOLUNTEER_OTHER] },
            { type: Tracking.RESTORATION_PARTNERS_TYPE, collection: [DIRECT_OTHER, INDIRECT_OTHER] }
          ]
        },
        attributes: ["type", "description"]
      });
    const paidOtherActivityDescription =
      demographics.find(({ type }) => type === Tracking.WORKDAYS_TYPE)?.description ?? null;
    const otherRestorationPartnersDescription =
      demographics.find(({ type }) => type === Tracking.RESTORATION_PARTNERS_TYPE)?.description ?? null;
    return { paidOtherActivityDescription, otherRestorationPartnersDescription };
  }
}

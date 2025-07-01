import { ProjectReport } from "@terramatch-microservices/database/entities/project-report.entity";
import { ReportProcessor } from "./entity-processor";
import { ProjectReportFullDto, ProjectReportLightDto, ProjectReportMedia } from "../dto/project-report.dto";
import { EntityQueryDto, SideloadType } from "../dto/entity-query.dto";
import { Includeable, Op } from "sequelize";
import { BadRequestException } from "@nestjs/common";
import { FrameworkKey } from "@terramatch-microservices/database/constants/framework";
import {
  Demographic,
  DemographicEntry,
  Media,
  NurseryReport,
  Project,
  ProjectUser,
  Seeding,
  SiteReport,
  TreeSpecies
} from "@terramatch-microservices/database/entities";
import { ProcessableAssociation } from "../entities.service";
import { DocumentBuilder } from "@terramatch-microservices/common/util";
import { ReportUpdateAttributes } from "../dto/entity-update.dto";
import { Literal } from "sequelize/types/utils";

const SUPPORTED_ASSOCIATIONS: ProcessableAssociation[] = ["demographics", "seedings", "treeSpecies"];

const SIMPLE_FILTERS: (keyof EntityQueryDto)[] = [
  "status",
  "updateRequestStatus",
  "frameworkKey",
  "organisationUuid",
  "country",
  "projectUuid"
];

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
        builder.order([query.sort.field, query.sort.direction ?? "ASC"]);
      } else if (query.sort.field === "projectName") {
        builder.order(["project", "name", query.sort.direction ?? "ASC"]);
      } else if (query.sort.field === "organisationName") {
        builder.order(["project", "organisation", "name", query.sort.direction ?? "ASC"]);
      } else if (query.sort.field !== "id") {
        throw new BadRequestException(`Invalid sort field: ${query.sort.field}`);
      }
    }

    const permissions = await this.entitiesService.getPermissions();
    const frameworkPermissions = permissions
      ?.filter(name => name.startsWith("framework-"))
      .map(name => name.substring("framework-".length) as FrameworkKey);
    if (frameworkPermissions?.length > 0) {
      builder.where({ frameworkKey: { [Op.in]: frameworkPermissions } });
    } else if (permissions?.includes("manage-own")) {
      builder.where({ projectId: { [Op.in]: ProjectUser.userProjectsSubquery(this.entitiesService.userId) } });
    } else if (permissions?.includes("projects-manage")) {
      builder.where({ projectId: { [Op.in]: ProjectUser.projectsManageSubquery(this.entitiesService.userId) } });
    }

    const associationFieldMap = {
      organisationUuid: "$project.organisation.uuid$",
      country: "$project.country$",
      projectUuid: "$project.uuid$"
    };

    for (const term of SIMPLE_FILTERS) {
      if (query[term] != null) {
        const field = associationFieldMap[term] ?? term;
        builder.where({ [field]: query[term] });
      }
    }

    if (query.taskId != null) {
      builder.where({ taskId: query.taskId });
    }

    if (query.search != null) {
      builder.where({
        [Op.or]: [
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

    const dto = new ProjectReportFullDto(projectReport, {
      ...(await this.getTaskDependentAggregates(projectReport.id, projectReport.taskId)),
      reportTitle,
      seedlingsGrown: await this.getSeedlingsGrown(projectReport),
      ...(this.entitiesService.mapMediaCollection(
        await Media.for(projectReport).findAll(),
        ProjectReport.MEDIA,
        "projectReports",
        projectReport.uuid
      ) as ProjectReportMedia)
    });

    return { id: projectReport.uuid, dto };
  }

  async getTaskDependentAggregates(projectReportId: number, taskId: number | null) {
    if (taskId == null) {
      return {
        seedsPlantedCount: 0,
        treesPlantedCount: 0,
        regeneratedTreesCount: 0,
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
      nonTreeTotal: (await Seeding.visible().siteReports(siteReportsIdsTask).sum("amount")) ?? 0,
      taskTotalWorkdays: await this.getTaskTotalWorkdays(projectReportId, siteReportsIdsTask),
      siteReportsCount: await SiteReport.task(taskId).count(),
      nurseryReportsCount: await NurseryReport.task(taskId).count()
    };
  }

  async getLightDto(projectReport: ProjectReport) {
    return { id: projectReport.uuid, dto: new ProjectReportLightDto(projectReport) };
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
    const projectReportDemographics = Demographic.idsSubquery(
      [projectReportId],
      ProjectReport.LARAVEL_TYPE,
      Demographic.WORKDAYS_TYPE
    );
    const siteReportDemographics = Demographic.idsSubquery(siteIds, SiteReport.LARAVEL_TYPE, Demographic.WORKDAYS_TYPE);
    return (
      (await DemographicEntry.gender().sum("amount", {
        where: {
          demographicId: {
            [Op.or]: [{ [Op.in]: projectReportDemographics }, { [Op.in]: siteReportDemographics }]
          }
        }
      })) ?? 0
    );
  }
}

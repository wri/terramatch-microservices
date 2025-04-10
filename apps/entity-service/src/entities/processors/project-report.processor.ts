import { ProjectReport } from "@terramatch-microservices/database/entities/project-report.entity";
import { EntityProcessor } from "./entity-processor";
import {
  AdditionalProjectReportFullProps,
  ProjectReportFullDto,
  ProjectReportLightDto,
  ProjectReportMedia
} from "../dto/project-report.dto";
import { EntityQueryDto } from "../dto/entity-query.dto";
import { Includeable, Op } from "sequelize";
import { BadRequestException } from "@nestjs/common";
import { FrameworkKey } from "@terramatch-microservices/database/constants/framework";
import {
  Media,
  NurseryReport,
  Project,
  ProjectUser,
  Seeding,
  SiteReport,
  TreeSpecies
} from "@terramatch-microservices/database/entities";
import { sumBy } from "lodash";
import { EntityUpdateAttributes } from "../dto/entity-update.dto";

export class ProjectReportProcessor extends EntityProcessor<
  ProjectReport,
  ProjectReportLightDto,
  ProjectReportFullDto,
  EntityUpdateAttributes
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
        {
          association: "user",
          attributes: ["uuid", "firstName", "lastName"]
        },
        {
          association: "task",
          attributes: ["uuid"]
        }
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
    if (query.sort != null) {
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

    for (const term of [
      "status",
      "updateRequestStatus",
      "frameworkKey",
      "organisationUuid",
      "country",
      "projectUuid"
    ]) {
      if (query[term] != null) {
        const field = associationFieldMap[term] ?? term;
        builder.where({ [field]: query[term] });
      }
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

  async getFullDto(projectReport: ProjectReport) {
    const projectReportId = projectReport.id;
    const taskId = projectReport.taskId;
    const reportTitle = await this.getReportTitle(projectReport);
    const siteReportsIdsTask = ProjectReport.siteReportIdsTaskSubquery([taskId]);
    const seedsPlantedCount = (await Seeding.visible().siteReports(siteReportsIdsTask).sum("amount")) ?? 0;
    const treesPlantedCount =
      (await TreeSpecies.visible().collection("tree-planted").siteReports(siteReportsIdsTask).sum("amount")) ?? 0;
    const approvedSiteReportsFromTask = await SiteReport.approved()
      .task(taskId)
      .findAll({ attributes: ["id", "siteId", "numTreesRegenerating"] });
    const regeneratedTreesCount = sumBy(approvedSiteReportsFromTask, "numTreesRegenerating");
    const siteReportsCount = await SiteReport.task(taskId).count();
    const nurseryReportsCount = await NurseryReport.task(taskId).count();
    const migrated = projectReport.oldModel != null;
    const seedlingsGrown = await this.getSeedlingsGrown(projectReport);
    const siteReportsUnsubmittedIdsTask = await ProjectReport.siteReportsUnsubmittedIdsTaskSubquery([taskId]);
    const nonTreeTotal = (await Seeding.visible().siteReports(siteReportsUnsubmittedIdsTask).sum("amount")) ?? 0;
    const readableCompletionStatus = await this.getReadableCompletionStatus(projectReport.completion);
    const createdByUser = projectReport.user ?? null;
    const props: AdditionalProjectReportFullProps = {
      reportTitle,
      seedsPlantedCount,
      treesPlantedCount,
      regeneratedTreesCount,
      siteReportsCount,
      nurseryReportsCount,
      migrated,
      seedlingsGrown,
      nonTreeTotal,
      readableCompletionStatus,
      createdByUser,
      ...(this.entitiesService.mapMediaCollection(
        await Media.projectReport(projectReportId).findAll(),
        ProjectReport.MEDIA
      ) as ProjectReportMedia)
    };

    return { id: projectReport.uuid, dto: new ProjectReportFullDto(projectReport, props) };
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

    if (projectReport.frameworkKey == "terrafund") {
      return (await NurseryReport.task(projectReport.taskId).sum("seedlingsYoungTrees")) ?? 0;
    }

    return 0;
  }

  protected async getReadableCompletionStatus(completion: number) {
    return completion === 0 ? "Not Started" : completion === 100 ? "Complete" : "Started";
  }
}

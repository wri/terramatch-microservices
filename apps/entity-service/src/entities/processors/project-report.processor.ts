import { ProjectReport } from "@terramatch-microservices/database/entities/project-report.entity";
import { EntityProcessor } from "./entity-processor";
import { AdditionalProjectReportFullProps, ProjectReportFullDto, ProjectReportMedia } from "../dto/project-report.dto";
import { ProjectReportLightDto } from "../dto/project-report.dto";
import { EntityQueryDto } from "../dto/entity-query.dto";
import { DocumentBuilder } from "@terramatch-microservices/common/util/json-api-builder";
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
import { Subquery } from "@terramatch-microservices/database/util/subquery.builder";

export class ProjectReportProcessor extends EntityProcessor<
  ProjectReport,
  ProjectReportLightDto,
  ProjectReportFullDto
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
          include: [{ association: "organisation", attributes: ["name"] }]
        }
      ]
    });
  }

  async findMany(query: EntityQueryDto, userId?: number, permissions?: string[]) {
    const projectAssociation: Includeable = {
      association: "project",
      attributes: ["uuid", "name"],
      include: [{ association: "organisation", attributes: ["name"] }]
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

    const frameworkPermissions = permissions
      ?.filter(name => name.startsWith("framework-"))
      .map(name => name.substring("framework-".length) as FrameworkKey);
    if (frameworkPermissions?.length > 0) {
      builder.where({ frameworkKey: { [Op.in]: frameworkPermissions } });
    } else if (permissions?.includes("manage-own")) {
      builder.where({ projectId: { [Op.in]: ProjectUser.userProjectsSubquery(userId) } });
    } else if (permissions?.includes("projects-manage")) {
      builder.where({ projectId: { [Op.in]: ProjectUser.projectsManageSubquery(userId) } });
    }

    for (const term of ["status", "updateRequestStatus", "frameworkKey"]) {
      if (query[term] != null) builder.where({ [term]: query[term] });
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

  async addFullDto(document: DocumentBuilder, projectReport: ProjectReport) {
    const projectReportId = projectReport.id;
    const taskId = projectReport.taskId;
    const reportTitle = await this.getReportTitle(projectReport);
    const siteReportsIdsTaks = ProjectReport.siteReportIdsTaksSubquery([taskId]);
    const seedsPlantedCount = (await Seeding.visible().siteReports(siteReportsIdsTaks).sum("amount")) ?? 0;
    const treesPlantedCount =
      (await TreeSpecies.visible().collection("tree-planted").siteReports(siteReportsIdsTaks).sum("amount")) ?? 0;
    const approvedSiteReportsFromTask = await SiteReport.approved()
      .reportsTask(taskId)
      .findAll({ attributes: ["id", "siteId", "numTreesRegenerating"] });
    const regeneratedTreesCount = sumBy(approvedSiteReportsFromTask, "numTreesRegenerating");
    const siteReportsCount = await SiteReport.reportsTask(taskId).count();
    const nurseryReportsCount = await NurseryReport.reportsTask(taskId).count();
    const migrated = !!projectReport.oldModel;
    const seedlingsGrown = await this.getSeedlingsGrown(projectReport);
    const siteReportsUnsubmittedIdsTask = await ProjectReport.siteReportsUnsubmittedIdsTaskSubquery([taskId]);
    const nonTreeTotal = (await Seeding.visible().siteReports(siteReportsUnsubmittedIdsTask).sum("amount")) ?? 0;
    const readableCompletionStatus = await this.getReadableCompletionStatus(projectReport.completion);
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
      directRestorationPartners: 0,
      indirectRestorationPartners: 0,
      ...(this.entitiesService.mapMediaCollection(
        await Media.projectReport(projectReportId).findAll(),
        ProjectReport.MEDIA
      ) as ProjectReportMedia)
    };
    document.addData(projectReport.uuid, new ProjectReportFullDto(projectReport, props));
  }

  async addLightDto(document: DocumentBuilder, projectReport: ProjectReport) {
    document.addData(projectReport.uuid, new ProjectReportLightDto(projectReport));
  }

  protected async getReportTitle(projectReport: ProjectReport) {
    if (projectReport.frameworkKey == "ppc" || !projectReport.dueAt) {
      return projectReport.title ?? "";
    } else {
      const dueAt = new Date(projectReport.dueAt);
      dueAt.setMonth(dueAt.getMonth() - 1);
      const wEnd = dueAt.toLocaleString("en-US", { month: "long", year: "numeric" });

      dueAt.setMonth(dueAt.getMonth() - 5);
      const wStart = dueAt.toLocaleString("en-US", { month: "long" });

      return `Project Report  for ${wStart} - ${wEnd}`;
    }
  }

  protected async getSeedlingsGrown(projectReport: ProjectReport) {
    if (projectReport.frameworkKey == "ppc") {
      return TreeSpecies.visible().collection("tree-planted").projectReports([projectReport.id]).sum("amount");
    }

    if (projectReport.frameworkKey == "terrafund") {
      return NurseryReport.reportsTask(projectReport.taskId).sum("seedlingsYoungTrees");
    }

    return 0;
  }

  protected async getReadableCompletionStatus(completion: number) {
    return completion === 0 ? "Not Started" : completion === 100 ? "Complete" : "Started";
  }
}

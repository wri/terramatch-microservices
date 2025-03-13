import { ProjectReport } from "@terramatch-microservices/database/entities/project-report.entity";
import { EntityProcessor } from "./entity-processor";
import { AdditionalProjectReportFullProps, ProjectReportFullDto } from "../dto/project-report.dto";
import { ProjectReportLightDto } from "../dto/project-report.dto";
import { EntityQueryDto } from "../dto/entity-query.dto";
import { DocumentBuilder } from "@terramatch-microservices/common/util/json-api-builder";
import { Includeable, Op } from "sequelize";
import { BadRequestException } from "@nestjs/common";
import { FrameworkKey } from "@terramatch-microservices/database/constants/framework";
import { Project, ProjectUser } from "@terramatch-microservices/database/entities";

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
      include: [{ association: "project", attributes: ["uuid", "name"] }]
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
      builder.where({ name: { [Op.like]: `%${query.search}%` } });
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

  async addFullDto(document: DocumentBuilder, model: ProjectReport) {
    const props: AdditionalProjectReportFullProps = {};
    document.addData(model.uuid, new ProjectReportFullDto(model, props));
  }

  async addLightDto(document: DocumentBuilder, model: ProjectReport) {
    document.addData(model.uuid, new ProjectReportLightDto(model));
  }
}

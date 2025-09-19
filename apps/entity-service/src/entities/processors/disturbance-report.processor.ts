import {
  DisturbanceReport,
  DisturbanceReportEntry,
  Project,
  ProjectUser
} from "@terramatch-microservices/database/entities";
import { ReportProcessor } from "./entity-processor";
import { EntityQueryDto } from "../dto/entity-query.dto";
import { BadRequestException } from "@nestjs/common";
import { Op, Includeable } from "sequelize";
import { ReportUpdateAttributes } from "../dto/entity-update.dto";
import { DisturbanceReportFullDto, DisturbanceReportLightDto } from "../dto/disturbance-report.dto";
import { DisturbanceReportEntryDto } from "../dto/disturbance-report-entry.dto";
import { FrameworkKey } from "@terramatch-microservices/database/constants/framework";

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

export class DisturbanceReportProcessor extends ReportProcessor<
  DisturbanceReport,
  DisturbanceReportLightDto,
  DisturbanceReportFullDto,
  ReportUpdateAttributes
> {
  readonly LIGHT_DTO = DisturbanceReportLightDto;
  readonly FULL_DTO = DisturbanceReportFullDto;

  async findOne(uuid: string) {
    return await DisturbanceReport.findOne({
      where: { uuid },
      include: [
        {
          association: "project",
          attributes: ["id", "uuid", "name", "country"],
          include: [{ association: "organisation", attributes: ["uuid", "name"] }]
        }
      ]
    });
  }

  async findMany(query: EntityQueryDto) {
    const projectAssociation: Includeable = {
      association: "project",
      attributes: ["id", "uuid", "name"],
      include: [{ association: "organisation", attributes: ["uuid", "name"] }]
    };

    const associations = [projectAssociation];
    const builder = await this.entitiesService.buildQuery(DisturbanceReport, query, associations);

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

    for (const term of SIMPLE_FILTERS) {
      if (query[term] != null) {
        const field = ASSOCIATION_FIELD_MAP[term] ?? term;
        builder.where({ [field]: query[term] });
      }
    }

    if (query.search != null) {
      builder.where({
        [Op.or]: [
          { "$project.name$": { [Op.like]: `%${query.search}%` } },
          { "$project.organisation.name$": { [Op.like]: `%${query.search}%` } },
          { title: { [Op.like]: `%${query.search}%` } }
        ]
      });
    }

    if (query.projectUuid != null) {
      builder.where({ projectId: Project.forUuid(query.projectUuid) });
    }

    return { models: await builder.execute(), paginationTotal: await builder.paginationTotal() };
  }

  async getFullDto(disturbanceReport: DisturbanceReport) {
    const dto = new DisturbanceReportFullDto(disturbanceReport);

    return { id: disturbanceReport.uuid, dto };
  }

  protected async getDisturbanceReportEntries(disturbanceReport: DisturbanceReport) {
    const entries = await DisturbanceReportEntry.findAll({
      where: { disturbanceReportId: disturbanceReport.id }
    });
    return entries.map(
      entry =>
        new DisturbanceReportEntryDto(entry, {
          entityType: "disturbanceReports" as const,
          entityUuid: disturbanceReport.uuid
        })
    );
  }

  async getLightDto(disturbanceReport: DisturbanceReport) {
    const entries = await this.getDisturbanceReportEntries(disturbanceReport);
    const intensity = entries.find(entry => entry.name === "intensity")?.value ?? null;
    const dateOfDisturbance = entries.find(entry => entry.name === "date-of-disturbance")?.value;

    return {
      id: disturbanceReport.uuid,
      dto: new DisturbanceReportLightDto(disturbanceReport, {
        entries,
        intensity,
        dateOfDisturbance: dateOfDisturbance ? new Date(dateOfDisturbance) : null
      })
    };
  }
}

import {
  DisturbanceReport,
  DisturbanceReportEntry,
  Media,
  Project,
  ProjectUser
} from "@terramatch-microservices/database/entities";
import { ReportProcessor } from "./entity-processor";
import { EntityQueryDto } from "../dto/entity-query.dto";
import { BadRequestException } from "@nestjs/common";
import { CreationAttributes, Includeable, Op } from "sequelize";
import { ReportUpdateAttributes } from "../dto/entity-update.dto";
import {
  DisturbanceReportFullDto,
  DisturbanceReportLightDto,
  DisturbanceReportMedia
} from "../dto/disturbance-report.dto";
import { DisturbanceReportEntryDto } from "@terramatch-microservices/common/dto/disturbance-report-entry.dto";
import { FrameworkKey } from "@terramatch-microservices/database/constants/framework";
import { EntityCreateAttributes } from "../dto/entity-create.dto";

const REPORT_ENTRIES = [
  {
    name: "disturbance-type",
    inputType: "select",
    title: "Disturbance Type"
  },
  {
    name: "disturbance-subtype",
    inputType: "select-multi",
    title: "Disturbance Subtype"
  },
  {
    name: "intensity",
    inputType: "select",
    title: "Intensity"
  },
  {
    name: "extent",
    inputType: "select",
    title: "Extent"
  },
  {
    name: "people-affected",
    inputType: "number",
    title: "People Affected"
  },
  {
    name: "monetary-damage",
    inputType: "number",
    title: "Monetary Damage"
  },
  {
    name: "property-affected",
    inputType: "select-multi",
    title: "Property Affected"
  },
  {
    name: "date-of-disturbance",
    inputType: "date",
    title: "Date of Disturbance"
  },
  {
    name: "site-affected",
    inputType: "disturbanceAffectedSite",
    title: "Site Affected"
  },
  {
    name: "polygon-affected",
    inputType: "disturbanceAffectedPolygon",
    title: "Polygon Affected"
  }
];

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

  async create(createPayload: EntityCreateAttributes) {
    const project = await Project.findOne({
      where: { uuid: createPayload.parentUuid },
      attributes: ["frameworkKey", "id"]
    });
    if (project == null) {
      throw new BadRequestException(`Project with UUID ${createPayload.parentUuid} not found`);
    }

    const disturbanceReport = await this.authorizedCreation(DisturbanceReport, {
      frameworkKey: project.frameworkKey,
      projectId: project.id,
      status: "due",
      updateRequestStatus: "no-update",
      title: "Disturbance Report",
      createdBy: this.entitiesService.userId
    });

    await DisturbanceReportEntry.bulkCreate(
      REPORT_ENTRIES.map(entry => ({
        ...entry,
        disturbanceReportId: disturbanceReport.id
      })) as CreationAttributes<DisturbanceReportEntry>[]
    );

    return disturbanceReport;
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
    const entries = await this.getDisturbanceReportEntries(disturbanceReport);
    const intensity = entries.find(entry => entry.name === "intensity")?.value ?? null;
    const dateOfDisturbance = entries.find(entry => entry.name === "date-of-disturbance")?.value;
    const mediaCollection = await Media.for(disturbanceReport).findAll();
    const dto = new DisturbanceReportFullDto(disturbanceReport, {
      ...(await this.getFeedback(disturbanceReport)),
      reportId: disturbanceReport.id,
      entries,
      intensity,
      dateOfDisturbance: dateOfDisturbance != null ? new Date(dateOfDisturbance) : null,
      ...(this.entitiesService.mapMediaCollection(
        mediaCollection,
        DisturbanceReport.MEDIA,
        "disturbanceReports",
        disturbanceReport.uuid
      ) as DisturbanceReportMedia)
    });

    return { id: disturbanceReport.uuid, dto };
  }

  async getDisturbanceReportEntries(disturbanceReport: DisturbanceReport) {
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
        reportId: disturbanceReport.id,
        entries,
        intensity,
        dateOfDisturbance: dateOfDisturbance != null ? new Date(dateOfDisturbance) : null
      })
    };
  }
}

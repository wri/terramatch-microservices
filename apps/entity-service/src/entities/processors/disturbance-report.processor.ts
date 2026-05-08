import {
  DisturbanceReport,
  DisturbanceReportEntry,
  Media,
  Project,
  ProjectUser
} from "@terramatch-microservices/database/entities";
import { ExportAllOptions, ReportProcessor } from "./entity-processor";
import { EntityQueryDto } from "../dto/entity-query.dto";
import { BadRequestException, InternalServerErrorException } from "@nestjs/common";
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
import { Dictionary, flatten, kebabCase } from "lodash";
import { PaginatedQueryBuilder } from "@terramatch-microservices/common/util/paginated-query.builder";
import { batchFindAll } from "@terramatch-microservices/common/util/batch-find-all";
import { isNotNull } from "@terramatch-microservices/database/types/array";
import { timestampFileName } from "@terramatch-microservices/common/util/filenames";

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

const CSV_COLUMNS: Dictionary<string> = {
  id: "ID",
  uuid: "UUID",
  projectUuid: "Project UUID",
  projectName: "Project Name",
  status: "Status",
  dateOfDisturbance: "Date of Disturbance",
  extent: "Extent",
  propertyAffected: "Property Affected",
  peopleAffected: "People Affected",
  monetaryDamage: "Monetary Damage",
  description: "Description",
  actionDescription: "Action Description",
  disturbanceType: "Disturbance Type",
  disturbanceSubtype: "Disturbance Subtype",
  intensity: "Intensity",
  siteAffected: "Site Affected",
  polygonAffected: "Polygon Affected",
  mediaFiles: "Media Files",
  createdAt: "Created At",
  updatedAt: "Updated At",
  submittedAt: "Submitted At"
};

const decodeValue = (value: string | null) => {
  if (value == null) return value;

  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
};

const formatEntriesForExport = (entries: DisturbanceReportEntry[], name: string) => {
  return entries
    .filter(entry => entry.name === name)
    .map(entry => {
      if (name === "site-affected") {
        const affected = decodeValue(entry.value);
        if (!Array.isArray(affected)) return "";
        return affected
          .map(site => site["siteName"])
          .filter(isNotNull)
          .join("; ");
      } else if (name === "polygon-affected") {
        const affected = decodeValue(entry.value);
        if (!Array.isArray(affected)) return "";
        return flatten(
          affected.map(group => (!Array.isArray(group) ? null : group.map(poly => poly["polyName"]))).filter(isNotNull)
        ).join("; ");
      } else {
        return decodeValue(entry.value);
      }
    });
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

    // Load the full report with necessary associations.
    return (await this.findOne(disturbanceReport.uuid)) as DisturbanceReport;
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
        builder.order([[query.sort.field, query.sort.direction ?? "ASC"]]);
      } else if (query.sort.field === "projectName") {
        builder.order([["project", "name", query.sort.direction ?? "ASC"]]);
      } else if (query.sort.field === "organisationName") {
        builder.order([["project", "organisation", "name", query.sort.direction ?? "ASC"]]);
      } else if (query.sort.field !== "id") {
        throw new BadRequestException(`Invalid sort field: ${query.sort.field}`);
      }
    }

    const permissions = this.entitiesService.permissions;
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

    await this.entitiesService.removeHiddenValues(disturbanceReport, dto);

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

  async export() {
    throw new InternalServerErrorException("Individual export of disturbance report is not supported");
  }

  async exportAll({ target }: ExportAllOptions = {}) {
    const fileName = timestampFileName("Disturbance Reports Export");
    await this.entitiesService.writeCsv(fileName, target, CSV_COLUMNS, async addRow => {
      const builder = new PaginatedQueryBuilder(DisturbanceReport, 10, [
        {
          association: "project",
          attributes: ["uuid", "name"]
        }
      ]);

      for await (const page of batchFindAll(builder)) {
        await this.entitiesService.authorize("export", page);
        const entries = await DisturbanceReportEntry.findAll({
          where: { disturbanceReportId: page.map(({ id }) => id) }
        });
        const media = await Media.for(page).collection("media").findAll();

        for (const report of page) {
          const rowEntries = entries.filter(entry => entry.disturbanceReportId === report.id);
          const rowMedia = media.filter(media => media.modelId === report.id);
          addRow(report, {
            ...REPORT_ENTRIES.reduce(
              (acc, { name }) => ({
                ...acc,
                [kebabCase(name)]: formatEntriesForExport(rowEntries, name)
              }),
              {} as Dictionary<string>
            ),
            media: rowMedia.map(media => `${this.entitiesService.fullUrl(media)} (${media.name})`)
          });
        }
      }
    });
  }
}

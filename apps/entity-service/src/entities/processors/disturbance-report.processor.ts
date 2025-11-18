import {
  Disturbance,
  DisturbanceReport,
  DisturbanceReportEntry,
  Media,
  Project,
  ProjectUser,
  SitePolygon
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
import { DisturbanceReportEntryDto } from "../dto/disturbance-report-entry.dto";
import { FrameworkKey } from "@terramatch-microservices/database/constants/framework";
import { TMLogger } from "@terramatch-microservices/common/util/tm-logger";
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
  ReportUpdateAttributes,
  EntityCreateAttributes
> {
  readonly LIGHT_DTO = DisturbanceReportLightDto;
  readonly FULL_DTO = DisturbanceReportFullDto;
  private logger = new TMLogger(DisturbanceReportProcessor.name);

  async update(model: DisturbanceReport, update: ReportUpdateAttributes) {
    await super.update(model, update);

    if (update.status === "approved") {
      await this.processReportSpecificLogic(model);
    }
  }

  /**
   * Specific method for DisturbanceReport custom logic. This is called automatically when the report is approved.
   *
   * This method implements the workflow described in the task:
   * - When a polygon is identified as affected in a disturbance report, the site_polygon.disturbance_id field
   *   is populated with the v2_disturbances.id
   * - All new versions of the polygon will carry the disturbance_id with it, as occurs with other attributes
   * - Each polygon should only be identified in 1 disturbance
   * - Extracts disturbance details (intensity, extent, type, subtype, peopleAffected, monetaryDamage, propertyAffected)
   *   from disturbance report entries and populates the disturbance record
   */
  private async processReportSpecificLogic(model: DisturbanceReport): Promise<void> {
    const entries = await DisturbanceReportEntry.report(model.id).findAll();

    const affectedPolygonUuids = new Set<string>();
    const disturbanceData: Partial<Disturbance> = {};

    this.processPolygonEntry(entries, affectedPolygonUuids, disturbanceData);

    if (affectedPolygonUuids.size === 0) {
      return;
    }

    // Upsert disturbance for this report (align with PHP logic)
    const disturbanceUpsertData: CreationAttributes<Disturbance> = {
      disturbanceableType: DisturbanceReport.LARAVEL_TYPE,
      disturbanceableId: model.id,
      disturbanceDate: disturbanceData.disturbanceDate,
      type: disturbanceData.type,
      subtype: disturbanceData.subtype,
      intensity: disturbanceData.intensity,
      extent: disturbanceData.extent,
      peopleAffected: disturbanceData.peopleAffected,
      monetaryDamage: disturbanceData.monetaryDamage,
      propertyAffected: disturbanceData.propertyAffected,
      description: model.description,
      actionDescription: model.actionDescription,
      hidden: false
    };

    let disturbance = await Disturbance.findOne({
      where: { disturbanceableType: DisturbanceReport.LARAVEL_TYPE, disturbanceableId: model.id }
    });
    if (disturbance != null) {
      await disturbance.update(disturbanceUpsertData);
    } else {
      disturbance = await Disturbance.create(disturbanceUpsertData);
    }

    // Find all affected site polygons and validate they're not already affected by another disturbance
    const affectedPolygons = await SitePolygon.active().forUuids(Array.from(affectedPolygonUuids)).findAll();

    // Check for polygons that are already affected by another disturbance
    const alreadyAffectedPolygons = affectedPolygons.filter(polygon => polygon.disturbanceId != null);
    if (alreadyAffectedPolygons.length > 0) {
      this.logger.warn(
        `The following polygons are already affected by another disturbance: ${alreadyAffectedPolygons
          .map(p => p.uuid)
          .join(", ")}`
      );
    }

    await SitePolygon.update(
      { disturbanceId: disturbance.id },
      {
        where: {
          uuid: { [Op.in]: Array.from(affectedPolygonUuids) },
          disturbanceId: null
        }
      }
    );
  }

  private processPolygonEntry(
    entries: DisturbanceReportEntry[],
    affectedPolygonUuids: Set<string>,
    disturbanceData: Partial<Disturbance>
  ): void {
    for (const entry of entries) {
      // Look for entries that contain affected polygon UUIDs
      // Based on the task requirements, this should identify which polygons have been impacted
      if (entry.name === "polygon-affected" && entry.value != null) {
        try {
          const parsedValue = JSON.parse(entry.value);
          if (Array.isArray(parsedValue)) {
            parsedValue.forEach(polygonGroup => {
              if (Array.isArray(polygonGroup)) {
                polygonGroup.forEach(polygonObj => {
                  if (polygonObj != null && typeof polygonObj === "object" && polygonObj.polyUuid != null) {
                    affectedPolygonUuids.add(polygonObj.polyUuid);
                  }
                });
              } else if (polygonGroup != null && typeof polygonGroup === "object" && polygonGroup.polyUuid != null) {
                affectedPolygonUuids.add(polygonGroup.polyUuid);
              }
            });
          }
        } catch (error) {
          this.logger.warn(`Failed to parse polygon JSON: ${error.message}, trying comma-separated values`);
          const uuids = entry.value
            .split(",")
            .map(uuid => uuid.trim())
            .filter(uuid => uuid != null && uuid !== "");
          uuids.forEach(uuid => affectedPolygonUuids.add(uuid));
        }
      }

      this.processDisturbanceDataEntry(entry, disturbanceData);
    }
  }

  private processDisturbanceDataEntry(entry: DisturbanceReportEntry, disturbanceData: Partial<Disturbance>): void {
    if (entry.value == null) return;

    switch (entry.name) {
      case "intensity":
        disturbanceData.intensity = entry.value;
        break;
      case "extent":
        disturbanceData.extent = entry.value;
        break;
      case "disturbance-type":
        disturbanceData.type = entry.value;
        break;
      case "disturbance-subtype":
        try {
          const parsed = JSON.parse(entry.value);
          if (parsed != null) {
            disturbanceData.subtype = parsed;
          }
        } catch {
          this.logger.warn(`Failed to parse subtype JSON: ${entry.value}`);
        }
        break;
      case "people-affected": {
        const peopleAffected = Number(entry.value);
        if (!isNaN(peopleAffected)) {
          disturbanceData.peopleAffected = peopleAffected;
        }
        break;
      }
      case "monetary-damage": {
        const monetaryDamage = Number(entry.value);
        if (!isNaN(monetaryDamage)) {
          disturbanceData.monetaryDamage = monetaryDamage;
        }
        break;
      }
      case "property-affected":
        try {
          const parsed = JSON.parse(entry.value);
          if (parsed != null) {
            disturbanceData.propertyAffected = parsed;
          }
        } catch {
          this.logger.warn(`Failed to parse propertyAffected JSON: ${entry.value}`);
        }
        break;
      case "date-of-disturbance": {
        const date = new Date(entry.value);
        if (!isNaN(date.getTime()) && date.getTime() > 0) {
          disturbanceData.disturbanceDate = date;
        }
        break;
      }
      default:
        this.logger.error(`Unknown disturbance report entry name: ${entry.name}`);
        break;
    }
  }

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
    const project = await Project.findOne({ where: { uuid: createPayload.parentUuid } });
    if (project == null) {
      throw new BadRequestException(`Project with UUID ${createPayload.parentUuid} not found`);
    }

    const transaction = await DisturbanceReport.sql.transaction();
    const disturbanceReport = await DisturbanceReport.create(
      {
        frameworkKey: project.frameworkKey,
        projectId: project.id,
        status: "due",
        updateRequestStatus: "no-update",
        title: "Disturbance Report",
        createdBy: this.entitiesService.userId
      },
      { transaction }
    );

    try {
      await this.entitiesService.authorize("create", disturbanceReport);
    } catch (e) {
      await transaction.rollback();
      throw e;
    }

    await transaction.commit();

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

import {
  DisturbanceReport,
  DisturbanceReportEntry,
  Project,
  ProjectUser,
  SitePolygon,
  Disturbance,
  Media
} from "@terramatch-microservices/database/entities";
import { ReportProcessor } from "./entity-processor";
import { EntityQueryDto } from "../dto/entity-query.dto";
import { BadRequestException } from "@nestjs/common";
import { Op, Includeable } from "sequelize";
import { ReportUpdateAttributes } from "../dto/entity-update.dto";
import {
  DisturbanceReportFullDto,
  DisturbanceReportLightDto,
  DisturbanceReportMedia
} from "../dto/disturbance-report.dto";
import { DisturbanceReportEntryDto } from "../dto/disturbance-report-entry.dto";
import { FrameworkKey } from "@terramatch-microservices/database/constants/framework";
import { TMLogger } from "@terramatch-microservices/common/util/tm-logger";

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
  private logger = new TMLogger(DisturbanceReportProcessor.name);
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
  protected async processReportSpecificLogic(model: DisturbanceReport): Promise<void> {
    const entries = await DisturbanceReportEntry.report(model.id).findAll();

    const affectedPolygonUuids = new Set<string>();
    const disturbanceData: Partial<Disturbance> = {};

    for (const entry of entries) {
      // Look for entries that contain affected polygon UUIDs
      // Based on the task requirements, this should identify which polygons have been impacted
      const polygonFieldNames = ["polygon-affected"];

      if (polygonFieldNames.includes(entry.name) && entry.value) {
        this.logger.debug(`Processing polygon field: ${entry.name} with value: ${entry.value}`);
        try {
          const parsedValue = JSON.parse(entry.value);
          if (Array.isArray(parsedValue)) {
            parsedValue.forEach((polygonGroup, groupIndex) => {
              if (Array.isArray(polygonGroup)) {
                // Handle array of arrays format
                polygonGroup.forEach(polygonObj => {
                  if (polygonObj && typeof polygonObj === "object" && polygonObj.polyUuid) {
                    this.logger.debug(
                      `Adding polygon UUID: ${polygonObj.polyUuid} (${polygonObj.polyName}) from group ${groupIndex}`
                    );
                    affectedPolygonUuids.add(polygonObj.polyUuid);
                  }
                });
              } else if (polygonGroup && typeof polygonGroup === "object" && polygonGroup.polyUuid) {
                // Handle direct object format (fallback)
                this.logger.debug(`Adding polygon UUID: ${polygonGroup.polyUuid} (${polygonGroup.polyName})`);
                affectedPolygonUuids.add(polygonGroup.polyUuid);
              }
            });
          }
        } catch (error) {
          this.logger.warn(`Failed to parse polygon JSON: ${error.message}, trying comma-separated values`);
          // If JSON parsing fails, try comma-separated values
          const uuids = entry.value
            .split(",")
            .map(uuid => uuid.trim())
            .filter(uuid => uuid);
          uuids.forEach(uuid => affectedPolygonUuids.add(uuid));
        }
      }

      switch (entry.name) {
        case "intensity":
          if (entry.value) disturbanceData.intensity = entry.value;
          break;
        case "extent":
          if (entry.value) disturbanceData.extent = entry.value;
          break;
        case "disturbance-type":
          if (entry.value) disturbanceData.type = entry.value;
          break;
        case "disturbance-subtype":
          if (entry.value) disturbanceData.subtype = entry.value ? JSON.parse(entry.value) : [];
          break;
        case "people-affected":
          if (entry.value) disturbanceData.peopleAffected = entry.value ? Number(entry.value) : null;
          break;
        case "monetary-damage":
          if (entry.value) disturbanceData.monetaryDamage = entry.value ? Number(entry.value) : null;
          break;
        case "property-affected":
          if (entry.value) disturbanceData.propertyAffected = entry.value ? JSON.parse(entry.value) : [];
          break;
        case "date-of-disturbance":
          if (entry.value) disturbanceData.disturbanceDate = entry.value ? new Date(entry.value) : null;
          break;
      }
    }

    if (affectedPolygonUuids.size === 0) {
      return;
    }

    const disturbanceCreateData = {
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
      hidden: 0
    } as Disturbance;

    const disturbance = await Disturbance.create(disturbanceCreateData);

    // Find all affected site polygons and validate they're not already affected by another disturbance
    const affectedPolygons = await SitePolygon.findAll({
      where: {
        uuid: { [Op.in]: Array.from(affectedPolygonUuids) },
        isActive: true
      }
    });

    // Check for polygons that are already affected by another disturbance
    const alreadyAffectedPolygons = affectedPolygons.filter(polygon => polygon.disturbanceId != null);
    if (alreadyAffectedPolygons.length > 0) {
      this.logger.warn(
        `The following polygons are already affected by another disturbance: ${alreadyAffectedPolygons
          .map(p => p.uuid)
          .join(", ")}`
      );
    }

    // Update all affected polygons with the disturbance_id, where they are not already affected by another disturbance
    await SitePolygon.update(
      { disturbanceId: disturbance.id },
      {
        where: {
          uuid: { [Op.in]: Array.from(affectedPolygonUuids) },
          isActive: true,
          disturbanceId: null
        }
      }
    );
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
        entries,
        intensity,
        dateOfDisturbance: dateOfDisturbance != null ? new Date(dateOfDisturbance) : null
      })
    };
  }
}

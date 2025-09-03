import { DisturbanceReport, Site, ProjectUser } from "@terramatch-microservices/database/entities";
import { ReportProcessor } from "./entity-processor";
import { EntityQueryDto } from "../dto/entity-query.dto";
import { BadRequestException } from "@nestjs/common";
import { Op, Includeable } from "sequelize";
import { ReportUpdateAttributes } from "../dto/entity-update.dto";
import { DisturbanceReportFullDto, DisturbanceReportLightDto } from "../dto/disturbance-report.dto";
import { FrameworkKey } from "@terramatch-microservices/database/constants/framework";

const SIMPLE_FILTERS: (keyof EntityQueryDto)[] = [
  "status",
  "updateRequestStatus",
  "frameworkKey",
  "siteUuid",
  "organisationUuid",
  "country",
  "projectUuid"
];

const ASSOCIATION_FIELD_MAP = {
  siteUuid: "$site.uuid$",
  organisationUuid: "$site.project.organisation.uuid$",
  country: "$site.project.country$",
  projectUuid: "$site.project.uuid$"
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
          association: "site",
          attributes: ["id", "uuid", "name"],
          include: [
            {
              association: "project",
              attributes: ["id", "uuid", "name"],
              include: [{ association: "organisation", attributes: ["uuid", "name"] }]
            }
          ]
        },
        { association: "createdByUser", attributes: ["id", "uuid", "firstName", "lastName"] },
        { association: "approvedByUser", attributes: ["id", "uuid", "firstName", "lastName"] }
      ]
    });
  }

  async findMany(query: EntityQueryDto) {
    const siteAssociation: Includeable = {
      association: "site",
      attributes: ["id", "uuid", "name"],
      include: [
        {
          association: "project",
          attributes: ["id", "uuid", "name"],
          include: [{ association: "organisation", attributes: ["id", "uuid", "name"] }]
        }
      ]
    };
    const associations = [siteAssociation];
    const builder = await this.entitiesService.buildQuery(DisturbanceReport, query, associations);

    if (query.sort?.field != null) {
      if (
        ["dueAt", "submittedAt", "updatedAt", "status", "updateRequestStatus", "dateOfIncident", "intensity"].includes(
          query.sort.field
        )
      ) {
        builder.order([query.sort.field, query.sort.direction ?? "ASC"]);
      } else if (query.sort.field === "organisationName") {
        builder.order(["site", "project", "organisation", "name", query.sort.direction ?? "ASC"]);
      } else if (query.sort.field === "projectName") {
        builder.order(["site", "project", "name", query.sort.direction ?? "ASC"]);
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
      builder.where({
        "$site.project.id$": { [Op.in]: ProjectUser.userProjectsSubquery(this.entitiesService.userId) }
      });
    } else if (permissions?.includes("projects-manage")) {
      builder.where({
        "$site.project.id$": { [Op.in]: ProjectUser.projectsManageSubquery(this.entitiesService.userId) }
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
          { "$site.name$": { [Op.like]: `%${query.search}%` } },
          { "$site.project.name$": { [Op.like]: `%${query.search}%` } },
          { "$site.project.organisation.name$": { [Op.like]: `%${query.search}%` } },
          { title: { [Op.like]: `%${query.search}%` } }
        ]
      });
    }

    if (query.siteUuid != null) {
      const site = await Site.findOne({ where: { uuid: query.siteUuid }, attributes: ["id"] });
      if (site == null) {
        throw new BadRequestException(`Site with uuid ${query.siteUuid} not found`);
      }
      builder.where({ siteId: site.id });
    }

    return { models: await builder.execute(), paginationTotal: await builder.paginationTotal() };
  }

  async getFullDto(disturbanceReport: DisturbanceReport) {
    const dto = new DisturbanceReportFullDto(disturbanceReport, {});

    return { id: disturbanceReport.uuid, dto };
  }

  async getLightDto(disturbanceReport: DisturbanceReport) {
    return { id: disturbanceReport.uuid, dto: new DisturbanceReportLightDto(disturbanceReport, {}) };
  }
}

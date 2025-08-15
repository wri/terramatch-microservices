import { Media, FinancialReport, ProjectUser } from "@terramatch-microservices/database/entities";
import { EntityStatus } from "@terramatch-microservices/database/constants/status";
import { EntityProcessor } from "./entity-processor";
import { EntityQueryDto } from "../dto/entity-query.dto";
import { Includeable, Op } from "sequelize";
import { BadRequestException } from "@nestjs/common";
import { FrameworkKey } from "@terramatch-microservices/database/constants/framework";
import { FinancialReportFullDto, FinancialReportLightDto, FinancialReportMedia } from "../dto/financial-report.dto";
import { FinancialReportUpdateAttributes } from "../dto/entity-update.dto";

const SIMPLE_FILTERS: (keyof EntityQueryDto)[] = [
  "status",
  "updateRequestStatus",
  "frameworkKey",
  "organisationUuid",
  "projectUuid",
  "yearOfReport"
];

const ASSOCIATION_FIELD_MAP = {
  organisationUuid: "$project.organisation.uuid$",
  projectUuid: "$project.uuid$"
};

export class FinancialReportProcessor extends EntityProcessor<
  FinancialReport,
  FinancialReportLightDto,
  FinancialReportFullDto,
  FinancialReportUpdateAttributes
> {
  readonly LIGHT_DTO = FinancialReportLightDto;
  readonly FULL_DTO = FinancialReportFullDto;

  async findOne(uuid: string) {
    return await FinancialReport.findOne({
      where: { uuid },
      include: [
        {
          association: "project",
          attributes: ["id", "uuid", "name"],
          include: [{ association: "organisation", attributes: ["uuid", "name"] }]
        },
        { association: "createdByUser", attributes: ["id", "uuid", "firstName", "lastName"] },
        { association: "approvedByUser", attributes: ["id", "uuid", "firstName", "lastName"] }
      ]
    });
  }

  async findMany(query: EntityQueryDto) {
    const projectAssociation: Includeable = {
      association: "project",
      attributes: ["id", "uuid", "name"],
      include: [{ association: "organisation", attributes: ["id", "uuid", "name"] }]
    };

    const builder = await this.entitiesService.buildQuery(FinancialReport, query, [projectAssociation]);

    if (query.sort?.field != null) {
      if (
        ["createdAt", "updatedAt", "submittedAt", "dueAt", "status", "updateRequestStatus", "yearOfReport"].includes(
          query.sort.field
        )
      ) {
        builder.order([query.sort.field, query.sort.direction ?? "ASC"]);
      } else if (query.sort.field === "organisationName") {
        builder.order(["project", "organisation", "name", query.sort.direction ?? "ASC"]);
      } else if (query.sort.field === "projectName") {
        builder.order(["project", "name", query.sort.direction ?? "ASC"]);
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
        "$project.id$": { [Op.in]: ProjectUser.userProjectsSubquery(this.entitiesService.userId) }
      });
    } else if (permissions?.includes("projects-manage")) {
      builder.where({
        "$project.id$": { [Op.in]: ProjectUser.projectsManageSubquery(this.entitiesService.userId) }
      });
    }

    SIMPLE_FILTERS.forEach(term => {
      const field = ASSOCIATION_FIELD_MAP[term] ?? term;
      if (query[term] != null) {
        builder.where({ [field]: query[term] });
      }
    });

    if (query.search != null) {
      builder.where({
        [Op.or]: [
          { "$project.name$": { [Op.like]: `%${query.search}%` } },
          { "$project.organisation.name$": { [Op.like]: `%${query.search}%` } },
          { title: { [Op.like]: `%${query.search}%` } },
          { description: { [Op.like]: `%${query.search}%` } }
        ]
      });
    }

    return { models: await builder.execute(), paginationTotal: await builder.paginationTotal() };
  }

  async getFullDto(financialReport: FinancialReport) {
    const mediaCollection = await Media.for(financialReport).findAll();
    const dto = new FinancialReportFullDto(financialReport, {
      ...(this.entitiesService.mapMediaCollection(
        mediaCollection,
        FinancialReport.MEDIA,
        "financialReports",
        financialReport.uuid
      ) as FinancialReportMedia)
    });

    return { id: financialReport.uuid, dto };
  }

  async getLightDto(financialReport: FinancialReport) {
    return { id: financialReport.uuid, dto: new FinancialReportLightDto(financialReport, {}) };
  }

  async update(financialReport: FinancialReport, attributes: FinancialReportUpdateAttributes): Promise<void> {
    const updateData: Partial<FinancialReport> = {};

    if (attributes.status !== undefined) {
      updateData.status = attributes.status as EntityStatus;
    }
    if (attributes.title !== undefined) {
      updateData.title = attributes.title;
    }
    if (attributes.description !== undefined) {
      updateData.description = attributes.description;
    }
    if (attributes.yearOfReport !== undefined) {
      updateData.yearOfReport = attributes.yearOfReport;
    }
    if (attributes.dueAt !== undefined) {
      updateData.dueAt = attributes.dueAt;
    }
    if (attributes.submittedAt !== undefined) {
      updateData.submittedAt = attributes.submittedAt;
    }
    if (attributes.tags !== undefined) {
      updateData.tags = attributes.tags;
    }

    await financialReport.update(updateData);
  }
}

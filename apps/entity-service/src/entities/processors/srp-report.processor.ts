import { Media, Project, ProjectUser, Site, SrpReport } from "@terramatch-microservices/database/entities";
import { ExportAllOptions, ReportProcessor } from "./entity-processor";
import { EntityQueryDto } from "../dto/entity-query.dto";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { Includeable, Op, WhereOptions } from "sequelize";
import { ReportUpdateAttributes } from "../dto/entity-update.dto";
import { SrpReportFullDto, SrpReportLightDto, SrpReportMedia } from "../dto/srp-report.dto";
import { FrameworkKey } from "@terramatch-microservices/database/constants/framework";
import { DateTime } from "luxon";
import { Dictionary } from "lodash";
import { PaginatedQueryBuilder } from "@terramatch-microservices/common/util/paginated-query.builder";
import { Archiver } from "archiver";
import { Response } from "express";
import { timestampFileName } from "@terramatch-microservices/common/util/filenames";

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

const ADMIN_CSV_COLUMNS: Dictionary<string> = {
  id: "ID",
  uuid: "UUID",
  projectUuid: "Project UUID",
  projectName: "Project Name",
  status: "Status",
  otherRestorationPartnersDescription: "Other Restoration Partners Description",
  totalUniqueRestorationPartners: "Total Unique Restoration Partners",
  year: "Year",
  createdAt: "Created At",
  updatedAt: "Updated At",
  submittedAt: "Submitted At"
};

const PD_CSV_COLUMNS: Dictionary<string> = {
  projectName: "Project Name",
  status: "Status",
  year: "Year",
  createdAt: "Created At",
  updatedAt: "Updated At",
  submittedAt: "Submitted At"
};

const CSV_EXPORT_INCLUDES = [
  {
    association: "project",
    attributes: ["id", "uuid", "name"]
  }
];

export class SrpReportProcessor extends ReportProcessor<
  SrpReport,
  SrpReportLightDto,
  SrpReportFullDto,
  ReportUpdateAttributes
> {
  readonly LIGHT_DTO = SrpReportLightDto;
  readonly FULL_DTO = SrpReportFullDto;

  async findOne(uuid: string) {
    return await SrpReport.findOne({
      where: { uuid },
      include: [
        {
          association: "project",
          attributes: ["id", "uuid", "name", "country", "status"],
          include: [{ association: "organisation", attributes: ["uuid", "name"] }]
        },
        { association: "task", attributes: ["uuid"] }
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
    const builder = await this.entitiesService.buildQuery(SrpReport, query, associations);

    if (query.sort?.field != null) {
      if (
        ["title", "status", "updateRequestStatus", "createdAt", "dueAt", "updatedAt", "submittedAt", "year"].includes(
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

    if (query.taskId != null) {
      builder.where({ taskId: query.taskId });
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

  async getFullDto(srpReport: SrpReport) {
    const mediaCollection = await Media.for(srpReport).findAll();
    const dto = new SrpReportFullDto(srpReport, {
      ...(await this.getFeedback(srpReport)),
      ...(this.entitiesService.mapMediaCollection(
        mediaCollection,
        SrpReport.MEDIA,
        "srpReports",
        srpReport.uuid
      ) as SrpReportMedia)
    });

    await this.entitiesService.removeHiddenValues(srpReport, dto);

    return { id: srpReport.uuid, dto };
  }

  async getLightDto(srpReport: SrpReport) {
    return {
      id: srpReport.uuid,
      dto: new SrpReportLightDto(srpReport, {
        reportId: srpReport.id
      })
    };
  }

  async export(uuid: string, target: Response | Archiver) {
    const report = await SrpReport.findOne({ where: { uuid }, include: CSV_EXPORT_INCLUDES });
    if (report == null) throw new NotFoundException();

    const fileName = `${report.projectName?.replace(/\/\\/g, "-")} - SRP Report - ${DateTime.now().toFormat(
      "yyyy-MM-dd HH:mm:ss"
    )}.csv`;
    await this.entitiesService.entityExport("srpReports", PD_CSV_COLUMNS, [report], {
      target,
      fileName,
      ability: "export"
    });
  }

  async exportAll({ target }: ExportAllOptions = {}) {
    const fileName = timestampFileName("Annual Socio Economic Restoration Reports Export");
    const where: WhereOptions<Site> = { "$project.is_test$": false };
    const permissions = this.entitiesService.permissions;
    if (permissions?.includes("manage-own")) {
      where["projectId"] = { [Op.in]: ProjectUser.userProjectsSubquery(this.entitiesService.userId as number) };
    } else if (permissions?.includes("projects-manage")) {
      where["projectId"] = { [Op.in]: ProjectUser.projectsManageSubquery(this.entitiesService.userId as number) };
    }

    const builder = new PaginatedQueryBuilder(SrpReport, 10, CSV_EXPORT_INCLUDES).where(where);
    await this.entitiesService.entityExport("srpReports", ADMIN_CSV_COLUMNS, builder, {
      target,
      fileName,
      ability: "export"
    });
  }
}

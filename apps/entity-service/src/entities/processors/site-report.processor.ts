import { Response } from "express";
import {
  Media,
  Project,
  ProjectReport,
  ProjectUser,
  Seeding,
  Site,
  SiteReport,
  Tracking,
  TreeSpecies
} from "@terramatch-microservices/database/entities";
import { ExportAllOptions, ReportProcessor } from "./entity-processor";
import { EntityQueryDto, SideloadType } from "../dto/entity-query.dto";
import { Includeable, literal, Op, WhereOptions } from "sequelize";
import { BadRequestException, InternalServerErrorException, NotFoundException } from "@nestjs/common";
import { FrameworkKey } from "@terramatch-microservices/database/constants/framework";
import { SiteReportFullDto, SiteReportLightDto, SiteReportMedia } from "../dto/site-report.dto";
import { ReportUpdateAttributes } from "../dto/entity-update.dto";
import { ProcessableAssociation, ProgressTick } from "../entities.service";
import { DocumentBuilder } from "@terramatch-microservices/common/util";
import { PAID_OTHER, VOLUNTEER_OTHER } from "@terramatch-microservices/database/constants/demographic-collections";
import { Dictionary } from "lodash";
import { PaginatedQueryBuilder } from "@terramatch-microservices/common/util/paginated-query.builder";
import { Archiver } from "archiver";
import { isoForFilename, normalizedFileName, timestampFileName } from "@terramatch-microservices/common/util/fileNames";
import { ServerResponse } from "node:http";
import { Literal } from "sequelize/types/utils";
import { apiAttributes } from "@terramatch-microservices/common/dto/json-api-attributes";

const SUPPORTED_ASSOCIATIONS: ProcessableAssociation[] = ["treeSpecies"];

const SIMPLE_FILTERS: (keyof EntityQueryDto)[] = [
  "status",
  "updateRequestStatus",
  "frameworkKey",
  "organisationUuid",
  "country",
  "projectUuid",
  "nothingToReport"
];

const ASSOCIATION_FIELD_MAP = {
  siteUuid: "$site.uuid$",
  organisationUuid: "$site.project.organisation.uuid$",
  country: "$site.project.country$",
  projectUuid: "$site.project.uuid$"
};

const PD_CSV_COLUMNS: Dictionary<string> = {
  organisationReadableType: "organization-readable_type",
  organisationName: "organization-name",
  projectName: "project_name",
  status: "status",
  updateRequestStatus: "update_request_status",
  dueAt: "due_date",
  createdAt: "created_at",
  updatedAt: "updated_at",
  siteName: "site-name",
  totalTreesPlantedReport: "total_trees_planted_report",
  totalTreesPlanted: "total_trees_planted",
  totalInvasiveTreesCount: "total_invasive_trees_count"
};

const ADMIN_CSV_COLUMNS: Dictionary<string> = {
  id: "id",
  uuid: "uuid",
  linkToTerramatch: "link_to_terramatch",
  organisationReadableType: "organization-readable_type",
  organisationName: "organization-name",
  projectName: "project_name",
  status: "status",
  updateRequestStatus: "update_request_status",
  dueAt: "due_date",
  createdAt: "created_at",
  updatedAt: "updated_at",
  projectExportId: "project_id",
  siteExportId: "site-id",
  siteName: "site-name",
  totalTreesPlantedReport: "total_trees_planted_report",
  totalTreesPlanted: "total_trees_planted",
  totalInvasiveTreesCount: "total_invasive_trees_count"
};

const CSV_EXPORT_INCLUDES = [
  {
    association: "site",
    attributes: ["name", "id", "ppcExternalId"],
    include: [
      {
        association: "project",
        attributes: ["name", "id", "ppcExternalId"],
        include: [
          {
            association: "organisation",
            attributes: ["name", "type"]
          }
        ]
      }
    ]
  }
];

const CSV_ATTRIBUTES = ["id", "uuid", "siteId", "status", "updateRequestStatus", "createdAt", "updatedAt", "dueAt"];

type CsvAdditional = {
  totalTreesPlantedReport?: number;
  totalTreesPlanted?: number;
  totalSeedsPlantedReport?: number;
  totalSeedsPlanted?: number;
};

export class SiteReportProcessor extends ReportProcessor<
  SiteReport,
  SiteReportLightDto,
  SiteReportFullDto,
  ReportUpdateAttributes
> {
  readonly LIGHT_DTO = SiteReportLightDto;
  readonly FULL_DTO = SiteReportFullDto;

  async findOne(uuid: string) {
    const entityAttributes = Object.keys(SiteReport.getAttributes());
    const computedAttributes = [
      SiteReport.TOTAL_TREES_REGENERATING_SPECIES_COUNT_ATTRIBUTE,
      SiteReport.TOTAL_SEEDS_PLANTED_COUNT_ATTRIBUTE,
      SiteReport.TOTAL_TREES_PLANTED_COUNT_ATTRIBUTE
    ];
    return await SiteReport.findOne({
      where: { uuid },
      attributes: [
        "id",
        "taskId",
        ...apiAttributes(SiteReportFullDto).filter(attr => entityAttributes.includes(attr)),
        ...computedAttributes.map(({ attribute }) => attribute)
      ],
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
        { association: "task", attributes: ["uuid"] },
        { association: "createdByUser", attributes: ["id", "uuid", "firstName", "lastName"] },
        { association: "approvedByUser", attributes: ["id", "uuid", "firstName", "lastName"] },
        ...computedAttributes.map(({ include }) => include)
      ],
      group: "SiteReport.id"
    });
  }

  async findMany(query: EntityQueryDto) {
    const associations: Includeable[] = [
      {
        association: "site",
        attributes: ["id", "uuid", "name"],
        include: [
          {
            association: "project",
            attributes: ["id", "uuid", "name"],
            include: [{ association: "organisation", attributes: ["id", "uuid", "name"] }]
          }
        ]
      },
      { association: "task", attributes: ["uuid"] }
    ];
    const builder = await this.entitiesService.buildQuery(SiteReport, query, associations);

    const entityAttributes = Object.keys(SiteReport.getAttributes());
    builder
      .attributes([...apiAttributes(SiteReportLightDto).filter(attr => entityAttributes.includes(attr)), "taskId"])
      .addComputedAttribute(SiteReport.TOTAL_TREES_PLANTED_COUNT_ATTRIBUTE)
      .addComputedAttribute(SiteReport.TOTAL_SEEDS_PLANTED_COUNT_ATTRIBUTE)
      .addComputedAttribute(SiteReport.TOTAL_TREES_REGENERATING_SPECIES_COUNT_ATTRIBUTE)
      .group("SiteReport.id");

    if (query.sort?.field != null) {
      const direction = query.sort.direction ?? "ASC";
      if (["dueAt", "updatedAt", "status", "updateRequestStatus", "submittedAt"].includes(query.sort.field)) {
        if (query.sort.field === "submittedAt") {
          if (direction === "ASC") {
            builder.order([literal("submitted_at IS NULL, submitted_at ASC")]);
          } else {
            // NULLs last, newest first
            builder.order([literal("submitted_at IS NULL ASC, submitted_at DESC")]);
          }
        } else {
          builder.order([[query.sort.field, direction]]);
        }
      } else if (query.sort.field === "organisationName") {
        builder.order([["site", "project", "organisation", "name", query.sort.direction ?? "ASC"]]);
      } else if (query.sort.field === "projectName") {
        builder.order([["site", "project", "name", query.sort.direction ?? "ASC"]]);
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
        "$site.project.id$": { [Op.in]: ProjectUser.userProjectsSubquery(this.entitiesService.userId as number) }
      });
    } else if (permissions?.includes("projects-manage")) {
      builder.where({
        "$site.project.id$": { [Op.in]: ProjectUser.projectsManageSubquery(this.entitiesService.userId as number) }
      });
    }

    for (const term of SIMPLE_FILTERS) {
      if (query[term] != null) {
        const field = ASSOCIATION_FIELD_MAP[term as keyof typeof ASSOCIATION_FIELD_MAP] ?? term;
        builder.where({
          [field]: term === "nothingToReport" ? this.nothingToReportConditions(query[term]) : query[term]
        });
      }
    }

    if (query.taskIds != null && query.taskIds.length > 0) {
      builder.where({ taskId: query.taskIds });
    }

    if (query.search != null) {
      builder.where({
        [Op.or]: [
          { "$site.name$": { [Op.like]: `%${query.search}%` } },
          { "$site.project.name$": { [Op.like]: `%${query.search}%` } },
          { "$site.project.organisation.name$": { [Op.like]: `%${query.search}%` } }
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

  async processSideload(document: DocumentBuilder, model: SiteReport, entity: SideloadType): Promise<void> {
    if (SUPPORTED_ASSOCIATIONS.includes(entity as ProcessableAssociation)) {
      const processor = this.entitiesService.createAssociationProcessor(
        "siteReports",
        model.uuid,
        entity as ProcessableAssociation
      );
      await processor.addDtos(document);
    } else {
      throw new BadRequestException(`Site reports only support sideloading: ${SUPPORTED_ASSOCIATIONS.join(", ")}`);
    }
  }

  async getFullDto(siteReport: SiteReport) {
    const siteReportId = siteReport.id;
    const reportTitle = await this.getReportTitle(siteReport);
    const projectReportTitle = await this.getProjectReportTitle(siteReport);
    const totalNonTreeSpeciesPlantedCount =
      (await TreeSpecies.visible().collection("non-tree").siteReports([siteReportId]).sum("amount")) ?? 0;
    const totalTreeReplantingCount =
      (await TreeSpecies.visible().collection("replanting").siteReports([siteReportId]).sum("amount")) ?? 0;
    const totalInvasiveTreesCount =
      (await TreeSpecies.visible().collection("invasive").siteReports([siteReportId]).sum("amount")) ?? 0;
    const mediaCollection = await Media.for(siteReport).findAll();
    const projectReportUuid =
      (await ProjectReport.findOne({ where: { taskId: siteReport.taskId }, attributes: ["uuid"] }))?.uuid ?? null;

    const dto = new SiteReportFullDto(siteReport, {
      ...(await this.getFeedback(siteReport)),
      ...(await this.getDemographicDescriptions(siteReport)),
      reportTitle,
      projectReportTitle,
      projectReportUuid,
      totalNonTreeSpeciesPlantedCount,
      totalTreeReplantingCount,
      totalInvasiveTreesCount,
      ...(this.entitiesService.mapMediaCollection(
        mediaCollection,
        SiteReport.MEDIA,
        "siteReports",
        siteReport.uuid
      ) as SiteReportMedia)
    });

    await this.entitiesService.removeHiddenValues(siteReport, dto);

    return { id: siteReport.uuid, dto };
  }

  async getLightDto(siteReport: SiteReport) {
    const reportTitle = await this.getReportTitle(siteReport);
    const projectReportUuid = await this.getProjectReportUuid(siteReport.taskId);
    return {
      id: siteReport.uuid,
      dto: new SiteReportLightDto(siteReport, { reportTitle, projectReportUuid: projectReportUuid })
    };
  }

  async export(uuid: string, target: Response | Archiver) {
    const report = await SiteReport.findOne({ where: { uuid }, include: CSV_EXPORT_INCLUDES });
    if (report == null) throw new NotFoundException();
    if (report.frameworkKey == null) throw new InternalServerErrorException("Cannot export without a framework key");

    const reportLabel = await this.entitiesService.localizeText("Site Report");
    const fileName = timestampFileName(`${report.projectName} - ${report.siteName} - ${reportLabel}`);
    await this.exportReports(report.frameworkKey, target, [report], fileName);
  }

  async exportAll({
    target,
    frameworkKey,
    projectUuid,
    siteId,
    fileNamePrefix,
    uuids
  }: ExportAllOptions & { siteId?: number } = {}) {
    if (uuids != null && uuids.length > 0) {
      const reports = await SiteReport.findAll({ where: { uuid: { [Op.in]: uuids } }, include: CSV_EXPORT_INCLUDES });
      if (reports.length === 0) return;
      await this.entitiesService.authorize("read", reports);
      frameworkKey ??= reports.find(report => report.frameworkKey != null)?.frameworkKey ?? undefined;
      if (frameworkKey == null) throw new InternalServerErrorException("Framework key not found");
      const reportsLabel = await this.entitiesService.localizeText("site reports");
      await this.exportReports(
        frameworkKey,
        target,
        reports,
        fileNamePrefix == null ? undefined : normalizedFileName(`${fileNamePrefix} - ${reportsLabel}`)
      );
      return;
    }

    if (frameworkKey == null && projectUuid != null) {
      frameworkKey =
        (await Project.findOne({ where: { uuid: projectUuid }, attributes: ["frameworkKey"] }))?.frameworkKey ??
        undefined;
    }
    if (frameworkKey == null) throw new InternalServerErrorException("Framework key not found");

    const where: WhereOptions<SiteReport> = {};
    if (siteId != null) {
      where["siteId"] = siteId;
    } else if (projectUuid != null) {
      where["$site.project.uuid$"] = projectUuid;
    } else {
      const permissions = this.entitiesService.permissions;
      where.frameworkKey = frameworkKey;
      where["$site.project.is_test$"] = false;
      if (permissions?.includes("manage-own")) {
        where["$site.project.id$"] = {
          [Op.in]: ProjectUser.userProjectsSubquery(this.entitiesService.userId as number)
        };
      } else if (permissions?.includes("projects-manage")) {
        where["$site.project.id$"] = {
          [Op.in]: ProjectUser.projectsManageSubquery(this.entitiesService.userId as number)
        };
      }
    }

    const reportsLabel = await this.entitiesService.localizeText("site reports");
    await this.exportReports(
      frameworkKey,
      target,
      new PaginatedQueryBuilder(SiteReport, 10, CSV_EXPORT_INCLUDES).where(where),
      fileNamePrefix == null ? undefined : normalizedFileName(`${fileNamePrefix} - ${reportsLabel}`)
    );
  }

  async exportMedia(uuids: string[] | Literal, archive: Archiver, progressTick?: ProgressTick) {
    const reports = await SiteReport.findAll({
      where: { uuid: { [Op.in]: uuids } },
      attributes: ["dueAt", "id"],
      include: [{ association: "site", attributes: ["name"] }]
    });
    if (reports.length === 0) return;

    const dirName = await this.entitiesService.localizeText("Site Reports");
    const defaultName = await this.entitiesService.localizeText("Unnamed");
    const publicLabel = await this.entitiesService.localizeText("public");
    const privateLabel = await this.entitiesService.localizeText("private");
    await this.entitiesService.exportMedia(
      reports,
      archive,
      (report, media) => {
        const prefix = report.dueAt == null ? "" : `${isoForFilename(report.dueAt, true)} - `;
        const siteName = report.site?.name ?? defaultName;
        return `${dirName}/${media.isPublic ? publicLabel : privateLabel}/${siteName}/${prefix}${media.fileName}`;
      },
      progressTick
    );
  }

  protected async exportReports(
    frameworkKey: FrameworkKey,
    target: Archiver | Response | undefined,
    source: PaginatedQueryBuilder<SiteReport> | SiteReport[],
    fileName?: string
  ) {
    const permissions = this.entitiesService.permissions;
    const adminExport = permissions == null || permissions.includes(`framework-${frameworkKey}`);
    const columns = {
      ...(adminExport ? ADMIN_CSV_COLUMNS : PD_CSV_COLUMNS),
      ...(frameworkKey === "ppc"
        ? { totalSeedsPlantedReport: "total_seeds_planted_report", totalSeedsPlanted: "total_seeds_planted" }
        : {})
    };

    const additionalDataForPage = async (page: SiteReport[]) =>
      (
        await Promise.all(
          page.map(async ({ id, siteId }) => {
            const totalTreesPlantedReport = await TreeSpecies.siteReports([id])
              .visible()
              .collection("tree-planted")
              .sum("amount");
            const allReports = SiteReport.idsSubquery([siteId]);
            const totalTreesPlanted = await TreeSpecies.siteReports(allReports)
              .visible()
              .collection("tree-planted")
              .sum("amount");
            const data: CsvAdditional & { id: number } = {
              id: id as number,
              totalTreesPlanted,
              totalTreesPlantedReport
            };

            if (frameworkKey === "ppc") {
              data.totalSeedsPlantedReport = await Seeding.siteReports([id]).visible().sum("amount");
              data.totalSeedsPlanted = await Seeding.siteReports(allReports).visible().sum("amount");
            }

            return data;
          })
        )
      ).reduce((acc, { id, ...rest }) => ({ ...acc, [id]: rest }), {} as Record<number, CsvAdditional>);

    await this.entitiesService.entityExport("siteReports", columns, source, {
      attributes: CSV_ATTRIBUTES,
      target,
      frameworkKey,
      additionalDataForPage,
      ability: target instanceof ServerResponse ? "read" : undefined,
      fileName
    });
  }

  protected async getReportTitle(siteReport: SiteReport) {
    return await this.getReportTitleBase(
      siteReport.dueAt,
      siteReport.title ?? (await this.entitiesService.localizeText("Site Report")),
      siteReport.frameworkKey ?? undefined
    );
  }

  protected async getProjectReportTitle(siteReport: SiteReport) {
    const projectReportTitle = await this.entitiesService.localizeText("Project Report");
    const { taskId } = siteReport;
    if (taskId == null) return projectReportTitle;

    const projectReport = await ProjectReport.findOne({ where: { taskId }, attributes: ["dueAt", "title"] });
    if (projectReport == null) return projectReportTitle;

    return await this.getReportTitleBase(
      projectReport.dueAt,
      projectReport.title ?? projectReportTitle,
      siteReport.frameworkKey ?? undefined
    );
  }

  protected async getDemographicDescriptions(siteReport: SiteReport) {
    const demographics = await Tracking.for(siteReport)
      .domain("demographics")
      .findAll({
        where: {
          description: { [Op.not]: null },
          type: Tracking.WORKDAYS_TYPE,
          collection: [PAID_OTHER, VOLUNTEER_OTHER]
        },
        attributes: ["description"]
      });

    const demographicDescription = demographics[0]?.description ?? null;
    const paidOtherActivityDescription = demographicDescription ?? siteReport.paidOtherActivityDescription ?? null;

    return { paidOtherActivityDescription };
  }

  protected _projectReportUuids: Dictionary<string | null> = {};
  protected async getProjectReportUuid(taskId: number) {
    if (this._projectReportUuids[taskId] === undefined) {
      this._projectReportUuids[taskId] =
        (await ProjectReport.findOne({ where: { taskId }, attributes: ["uuid"] }))?.uuid ?? null;
    }
    return this._projectReportUuids[taskId];
  }
}

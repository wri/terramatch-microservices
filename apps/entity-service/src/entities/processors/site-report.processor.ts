import {
  Media,
  ProjectReport,
  ProjectUser,
  Seeding,
  Site,
  SiteReport,
  TreeSpecies,
  User
} from "@terramatch-microservices/database/entities";
import { EntityProcessor } from "./entity-processor";
import { EntityQueryDto } from "../dto/entity-query.dto";
import { DocumentBuilder } from "@terramatch-microservices/common/util";
import { Includeable, Op } from "sequelize";
import { BadRequestException } from "@nestjs/common";
import { FrameworkKey } from "@terramatch-microservices/database/constants/framework";
import {
  AdditionalSiteReportFullProps,
  SiteReportFullDto,
  SiteReportLightDto,
  SiteReportMedia
} from "../dto/site-report.dto";

export class SiteReportProcessor extends EntityProcessor<SiteReport, SiteReportLightDto, SiteReportFullDto> {
  readonly LIGHT_DTO = SiteReportLightDto;
  readonly FULL_DTO = SiteReportFullDto;

  async findOne(uuid: string): Promise<SiteReport> {
    return await SiteReport.findOne({
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
        {
          association: "task",
          attributes: ["uuid"]
        }
      ]
    });
  }

  async findMany(query: EntityQueryDto, userId?: number, permissions?: string[]) {
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
    const builder = await this.entitiesService.buildQuery(SiteReport, query, associations);
    if (query.sort != null) {
      if (["dueAt", "submittedAt", "updatedAt", "status", "updateRequestStatus"].includes(query.sort.field)) {
        builder.order([query.sort.field, query.sort.direction ?? "ASC"]);
      } else if (query.sort.field === "organisationName") {
        builder.order(["site", "project", "organisation", "name", query.sort.direction ?? "ASC"]);
      } else if (query.sort.field === "projectName") {
        builder.order(["site", "project", "name", query.sort.direction ?? "ASC"]);
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
      builder.where({ "$site.project.id$": { [Op.in]: ProjectUser.userProjectsSubquery(userId) } });
    } else if (permissions?.includes("projects-manage")) {
      builder.where({ "$site.project.id$": { [Op.in]: ProjectUser.projectsManageSubquery(userId) } });
    }

    const associationFieldMap = {
      siteUuid: "$site.uuid$",
      organisationUuid: "$site.project.organisation.uuid$",
      country: "$site.project.country$",
      projectUuid: "$site.project.uuid$"
    };

    for (const term of [
      "status",
      "updateRequestStatus",
      "frameworkKey",
      "siteUuid",
      "organisationUuid",
      "country",
      "projectUuid"
    ]) {
      if (query[term] != null) {
        const field = associationFieldMap[term] ?? term;
        builder.where({ [field]: query[term] });
      }
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

  async addFullDto(document: DocumentBuilder, siteReport: SiteReport): Promise<void> {
    const siteReportId = siteReport.id;
    const reportTitle = await this.getReportTitle(siteReport);
    const projectReportTitle = await this.getProjectReportTitle(siteReport);
    const readableCompletionStatus = await this.getReadableCompletionStatus(siteReport.completion);
    const createdByUser = await User.findOne({ where: { id: siteReport?.createdBy } });
    const approvedByUser = await User.findOne({ where: { id: siteReport?.approvedBy } });
    const migrated = siteReport.oldModel != null;
    const totalTreesPlantedCount =
      (await TreeSpecies.visible().collection("tree-planted").siteReports([siteReportId]).sum("amount")) ?? 0;
    const totalSeedsPlantedCount = (await Seeding.visible().siteReports([siteReportId]).sum("amount")) ?? 0;
    const totalNonTreeSpeciesPlantedCount =
      (await TreeSpecies.visible().collection("non-tree").siteReports([siteReportId]).sum("amount")) ?? 0;
    const totalTreeReplantingCount =
      (await TreeSpecies.visible().collection("replanting").siteReports([siteReportId]).sum("amount")) ?? 0;
    const props: AdditionalSiteReportFullProps = {
      reportTitle,
      projectReportTitle,
      readableCompletionStatus,
      createdByUser,
      approvedByUser,
      migrated,
      totalTreesPlantedCount,
      totalSeedsPlantedCount,
      totalNonTreeSpeciesPlantedCount,
      totalTreeReplantingCount,
      projectReport: undefined,
      ...(this.entitiesService.mapMediaCollection(
        await Media.siteReport(siteReportId).findAll(),
        SiteReport.MEDIA
      ) as SiteReportMedia)
    };

    document.addData(siteReport.uuid, new SiteReportFullDto(siteReport, props));
  }

  async addLightDto(document: DocumentBuilder, siteReport: SiteReport): Promise<void> {
    const reportTitle = await this.getReportTitle(siteReport);
    document.addData(siteReport.uuid, new SiteReportLightDto(siteReport, { reportTitle }));
  }

  protected async getReportTitleBase(dueAt: Date | null, title: string | null, locale: string | null) {
    if (dueAt == null) return title ?? "";

    const adjustedDate = new Date(dueAt);
    adjustedDate.setMonth(adjustedDate.getMonth() - 1);
    const wEnd = adjustedDate.toLocaleString(locale, { month: "long", year: "numeric" });

    adjustedDate.setMonth(adjustedDate.getMonth() - 5);
    const wStart = adjustedDate.toLocaleString(locale, { month: "long" });

    return `Site Report for ${wStart} - ${wEnd}`;
  }

  protected async getReportTitle(siteReport: SiteReport) {
    return this.getReportTitleBase(siteReport.dueAt, siteReport.title, siteReport.user?.locale ?? "en-GB");
  }

  protected async getProjectReportTitle(siteReport: SiteReport) {
    const projectReport = await ProjectReport.findOne({ where: { taskId: siteReport.taskId } });

    return this.getReportTitleBase(projectReport.dueAt, projectReport.title, projectReport.user?.locale ?? "en-GB");
  }

  protected async getReadableCompletionStatus(completion: number) {
    return completion === 0 ? "Not Started" : completion === 100 ? "Complete" : "Started";
  }
}

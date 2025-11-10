import {
  Media,
  ProjectReport,
  ProjectUser,
  Seeding,
  Site,
  SiteReport,
  TreeSpecies
} from "@terramatch-microservices/database/entities";
import { ReportProcessor } from "./entity-processor";
import { EntityQueryDto, SideloadType } from "../dto/entity-query.dto";
import { Includeable, Op } from "sequelize";
import { BadRequestException } from "@nestjs/common";
import { FrameworkKey } from "@terramatch-microservices/database/constants/framework";
import { SiteReportFullDto, SiteReportLightDto, SiteReportMedia } from "../dto/site-report.dto";
import { ReportUpdateAttributes } from "../dto/entity-update.dto";
import { ProcessableAssociation } from "../entities.service";
import { DocumentBuilder } from "@terramatch-microservices/common/util";

const SUPPORTED_ASSOCIATIONS: ProcessableAssociation[] = ["treeSpecies"];

const SIMPLE_FILTERS: (keyof EntityQueryDto)[] = [
  "status",
  "updateRequestStatus",
  "frameworkKey",
  "siteUuid",
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

export class SiteReportProcessor extends ReportProcessor<
  SiteReport,
  SiteReportLightDto,
  SiteReportFullDto,
  ReportUpdateAttributes
> {
  readonly LIGHT_DTO = SiteReportLightDto;
  readonly FULL_DTO = SiteReportFullDto;

  async findOne(uuid: string) {
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
        { association: "task", attributes: ["uuid"] },
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
    const builder = await this.entitiesService.buildQuery(SiteReport, query, associations);
    if (query.sort?.field != null) {
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
        builder.where({
          [field]: term === "nothingToReport" ? this.nothingToReportConditions(query[term]) : query[term]
        });
      }
    }

    if (query.taskId != null) {
      builder.where({ taskId: query.taskId });
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
    const totalTreesPlantedCount =
      (await TreeSpecies.visible().collection("tree-planted").siteReports([siteReportId]).sum("amount")) ?? 0;
    const totalSeedsPlantedCount = (await Seeding.visible().siteReports([siteReportId]).sum("amount")) ?? 0;
    const totalNonTreeSpeciesPlantedCount =
      (await TreeSpecies.visible().collection("non-tree").siteReports([siteReportId]).sum("amount")) ?? 0;
    const totalTreeReplantingCount =
      (await TreeSpecies.visible().collection("replanting").siteReports([siteReportId]).sum("amount")) ?? 0;
    const mediaCollection = await Media.for(siteReport).findAll();
    const dto = new SiteReportFullDto(siteReport, {
      ...(await this.getFeedback(siteReport)),
      reportTitle,
      projectReportTitle,
      totalTreesPlantedCount,
      totalSeedsPlantedCount,
      totalNonTreeSpeciesPlantedCount,
      totalTreeReplantingCount,
      ...(this.entitiesService.mapMediaCollection(
        mediaCollection,
        SiteReport.MEDIA,
        "siteReports",
        siteReport.uuid
      ) as SiteReportMedia)
    });

    return { id: siteReport.uuid, dto };
  }

  async getLightDto(siteReport: SiteReport) {
    const reportTitle = await this.getReportTitle(siteReport);
    return { id: siteReport.uuid, dto: new SiteReportLightDto(siteReport, { reportTitle }) };
  }

  protected async getReportTitleBase(dueAt: Date | null, title: string, frameworkKey?: FrameworkKey) {
    if (dueAt == null) return title ?? "";

    const locale = await this.entitiesService.getUserLocale();

    const getRangeTitle = async () => {
      const adjustedDate = new Date(dueAt);
      adjustedDate.setMonth(adjustedDate.getMonth() - 1);
      const endDate = adjustedDate.toLocaleString(locale, { month: "long", year: "numeric" });

      adjustedDate.setMonth(adjustedDate.getMonth() - 5);
      const startDate = adjustedDate.toLocaleString(locale, { month: "long" });

      return await this.entitiesService.localizeText(`{title} for {startDate} - {endDate}`, {
        title,
        startDate,
        endDate
      });
    };

    if (frameworkKey === "ppc") {
      const cutoffOneMonth = new Date("2023-04-07T23:59:59.999Z");
      const cutoffThreeMonths = new Date("2023-07-01T00:00:00.000Z");

      if (dueAt <= cutoffOneMonth) {
        const prevMonth = new Date(dueAt);
        prevMonth.setMonth(prevMonth.getMonth() - 1);
        const month = prevMonth.toLocaleString(locale, { month: "long" });
        const year = prevMonth.getFullYear();
        return await this.entitiesService.localizeText(`{title} for {month} {year}`, {
          title,
          month,
          year
        });
      } else if (dueAt >= cutoffThreeMonths) {
        const endMonth = new Date(dueAt);
        endMonth.setMonth(endMonth.getMonth() - 1);
        const startMonth = new Date(dueAt);
        startMonth.setMonth(startMonth.getMonth() - 3);
        const startMonthName = startMonth.toLocaleString(locale, { month: "long" });
        const endMonthName = endMonth.toLocaleString(locale, { month: "long" });
        const year = endMonth.getFullYear();
        return await this.entitiesService.localizeText(`{title} for {startMonth}-{endMonth} {year}`, {
          title,
          startMonth: startMonthName,
          endMonth: endMonthName,
          year
        });
      } else {
        return await getRangeTitle();
      }
    } else {
      return await getRangeTitle();
    }
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
}

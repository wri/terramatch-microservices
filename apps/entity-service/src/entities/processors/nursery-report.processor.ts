import { Media, Nursery, NurseryReport, ProjectReport, ProjectUser } from "@terramatch-microservices/database/entities";
import { ReportProcessor } from "./entity-processor";
import { EntityQueryDto } from "../dto/entity-query.dto";
import { Includeable, Op } from "sequelize";
import { BadRequestException } from "@nestjs/common";
import { FrameworkKey } from "@terramatch-microservices/database/constants/framework";
import { NurseryReportFullDto, NurseryReportLightDto, NurseryReportMedia } from "../dto/nursery-report.dto";
import { ReportUpdateAttributes } from "../dto/entity-update.dto";

export class NurseryReportProcessor extends ReportProcessor<
  NurseryReport,
  NurseryReportLightDto,
  NurseryReportFullDto,
  ReportUpdateAttributes
> {
  readonly LIGHT_DTO = NurseryReportLightDto;
  readonly FULL_DTO = NurseryReportFullDto;

  async findOne(uuid: string) {
    return await NurseryReport.findOne({
      where: { uuid },
      include: [
        {
          association: "nursery",
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
    const nurseryAssociation: Includeable = {
      association: "nursery",
      attributes: ["id", "uuid", "name"],
      include: [
        {
          association: "project",
          attributes: ["id", "uuid", "name"],
          include: [{ association: "organisation", attributes: ["id", "uuid", "name"] }]
        }
      ]
    };

    const builder = await this.entitiesService.buildQuery(NurseryReport, query, [nurseryAssociation]);
    if (query.sort?.field != null) {
      if (["dueAt", "submittedAt", "updatedAt", "status", "updateRequestStatus"].includes(query.sort.field)) {
        builder.order([query.sort.field, query.sort.direction ?? "ASC"]);
      } else if (query.sort.field === "organisationName") {
        builder.order(["nursery", "project", "organisation", "name", query.sort.direction ?? "ASC"]);
      } else if (query.sort.field === "projectName") {
        builder.order(["nursery", "project", "name", query.sort.direction ?? "ASC"]);
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
        "$nursery.project.id$": { [Op.in]: ProjectUser.userProjectsSubquery(this.entitiesService.userId) }
      });
    } else if (permissions?.includes("projects-manage")) {
      builder.where({
        "$nursery.project.id$": { [Op.in]: ProjectUser.projectsManageSubquery(this.entitiesService.userId) }
      });
    }

    const associationFieldMap = {
      nurseryUuid: "$nursery.uuid$",
      organisationUuid: "$nursery.project.organisation.uuid$",
      country: "$nursery.project.country$",
      projectUuid: "$nursery.project.uuid$"
    };

    const termsToFilter = [
      "status",
      "updateRequestStatus",
      "frameworkKey",
      "nurseryUuid",
      "organisationUuid",
      "country",
      "projectUuid",
      "nothingToReport"
    ];

    termsToFilter.forEach(term => {
      const field = associationFieldMap[term] ?? term;
      if (query[term] != null) {
        builder.where({
          [field]:
            term === "nothingToReport"
              ? this.nothingToReportConditions([query[term]] as unknown as string)
              : query[term]
        });
      }
    });

    if (query.taskId != null) {
      builder.where({ taskId: query.taskId });
    }

    if (query.search != null) {
      builder.where({
        [Op.or]: [
          { "$nursery.project.name$": { [Op.like]: `%${query.search}%` } },
          { "$nursery.project.organisation.name$": { [Op.like]: `%${query.search}%` } }
        ]
      });
    }

    if (query.nurseryUuid != null) {
      const nursery = await Nursery.findOne({ where: { uuid: query.nurseryUuid }, attributes: ["id"] });
      if (nursery == null) {
        throw new BadRequestException(`Nursery with uuid ${query.nurseryUuid} not found`);
      }
      builder.where({ nurseryId: nursery.id });
    }

    return { models: await builder.execute(), paginationTotal: await builder.paginationTotal() };
  }

  async getFullDto(nurseryReport: NurseryReport) {
    const mediaCollection = await Media.for(nurseryReport).findAll();
    const reportTitle = await this.getReportTitle(nurseryReport);
    const projectReportTitle = await this.getProjectReportTitle(nurseryReport);
    const dto = new NurseryReportFullDto(nurseryReport, {
      reportTitle,
      projectReportTitle,
      ...(this.entitiesService.mapMediaCollection(
        mediaCollection,
        NurseryReport.MEDIA,
        "nurseryReports",
        nurseryReport.uuid
      ) as NurseryReportMedia)
    });

    return { id: nurseryReport.uuid, dto };
  }

  async getLightDto(nurseryReport: NurseryReport) {
    const reportTitle = await this.getReportTitle(nurseryReport);
    return { id: nurseryReport.uuid, dto: new NurseryReportLightDto(nurseryReport, { reportTitle }) };
  }

  protected async getReportTitleBase(dueAt: Date | null, title: string) {
    if (dueAt == null) return title ?? "";

    const adjustedDate = new Date(dueAt);
    adjustedDate.setMonth(adjustedDate.getMonth() - 1);
    const locale = await this.entitiesService.getUserLocale();
    const endDate = adjustedDate.toLocaleString(locale, { month: "long", year: "numeric" });

    adjustedDate.setMonth(adjustedDate.getMonth() - 5);
    const startDate = adjustedDate.toLocaleString(locale, { month: "long" });

    return await this.entitiesService.localizeText(`{title} for {startDate} - {endDate}`, {
      title,
      startDate,
      endDate
    });
  }

  protected async getReportTitle(nurseryReport: NurseryReport) {
    return await this.getReportTitleBase(
      nurseryReport.dueAt,
      nurseryReport.title ?? (await this.entitiesService.localizeText("Site Report"))
    );
  }

  protected async getProjectReportTitle(nurseryReport: NurseryReport) {
    const projectReportTitle = await this.entitiesService.localizeText("Project Report");
    const { taskId } = nurseryReport;
    if (taskId == null) return projectReportTitle;

    const projectReport = await ProjectReport.findOne({ where: { taskId }, attributes: ["dueAt", "title"] });
    if (projectReport == null) return projectReportTitle;

    return await this.getReportTitleBase(projectReport.dueAt, projectReport.title ?? projectReportTitle);
  }
}

import { Media, Nursery, NurseryReport, ProjectReport, ProjectUser } from "@terramatch-microservices/database/entities";
import { EntityProcessor } from "./entity-processor";
import { EntityQueryDto } from "../dto/entity-query.dto";
import { Includeable, Op } from "sequelize";
import { BadRequestException } from "@nestjs/common";
import { FrameworkKey } from "@terramatch-microservices/database/constants/framework";
import {
  AdditionalNurseryReportFullProps,
  NurseryReportFullDto,
  NurseryReportLightDto,
  NurseryReportMedia
} from "../dto/nursery-report.dto";

export class NurseryReportProcessor extends EntityProcessor<
  NurseryReport,
  NurseryReportLightDto,
  NurseryReportFullDto
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
        {
          association: "task",
          attributes: ["uuid"]
        },
        {
          association: "createdByUser",
          attributes: ["id", "uuid", "firstName", "lastName"]
        },
        {
          association: "approvedByUser",
          attributes: ["id", "uuid", "firstName", "lastName"]
        }
      ]
    });
  }

  async findMany(query: EntityQueryDto, userId?: number) {
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
    if (query.sort != null) {
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
      builder.where({ "$nursery.project.id$": { [Op.in]: ProjectUser.userProjectsSubquery(userId) } });
    } else if (permissions?.includes("projects-manage")) {
      builder.where({ "$nursery.project.id$": { [Op.in]: ProjectUser.projectsManageSubquery(userId) } });
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
      "projectUuid"
    ];

    termsToFilter.forEach(term => {
      const field = associationFieldMap[term] ?? term;
      if (query[term] != null) {
        builder.where({ [field]: query[term] });
      }
    });

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
    const nurseryReportId = nurseryReport.id;
    const mediaCollection = await Media.nurseryReport(nurseryReportId).findAll();
    const reportTitle = await this.getReportTitle(nurseryReport);
    const projectReportTitle = await this.getProjectReportTitle(nurseryReport);
    const migrated = nurseryReport.oldModel != null;
    const props: AdditionalNurseryReportFullProps = {
      reportTitle,
      projectReportTitle,
      migrated,
      ...(this.entitiesService.mapMediaCollection(mediaCollection, NurseryReport.MEDIA) as NurseryReportMedia)
    };

    return { id: nurseryReport.uuid, dto: new NurseryReportFullDto(nurseryReport, props) };
  }

  async getLightDto(nurseryReport: NurseryReport) {
    const reportTitle = await this.getReportTitle(nurseryReport);
    return { id: nurseryReport.uuid, dto: new NurseryReportLightDto(nurseryReport, { reportTitle }) };
  }

  protected async getReportTitleBase(dueAt: Date | null, title: string | null, locale: string | null) {
    if (dueAt == null) return title ?? "";

    const adjustedDate = new Date(dueAt);
    adjustedDate.setMonth(adjustedDate.getMonth() - 1);
    const wEnd = adjustedDate.toLocaleString(locale, { month: "long", year: "numeric" });

    adjustedDate.setMonth(adjustedDate.getMonth() - 5);
    const wStart = adjustedDate.toLocaleString(locale, { month: "long" });

    return `Nursery Report for ${wStart} - ${wEnd}`;
  }

  protected async getReportTitle(nurseryReport: NurseryReport) {
    return this.getReportTitleBase(nurseryReport.dueAt, nurseryReport.title, nurseryReport.user?.locale ?? "en-GB");
  }

  protected async getProjectReportTitle(nurseryReport: NurseryReport) {
    const projectReport = await ProjectReport.findOne({ where: { taskId: nurseryReport.taskId } });

    return this.getReportTitleBase(projectReport.dueAt, projectReport.title, projectReport.user?.locale ?? "en-GB");
  }
}

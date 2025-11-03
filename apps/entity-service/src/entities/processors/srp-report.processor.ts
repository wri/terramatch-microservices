import { Project, ProjectUser, Media, SrpReport } from "@terramatch-microservices/database/entities";
import { ReportProcessor } from "./entity-processor";
import { EntityQueryDto } from "../dto/entity-query.dto";
import { BadRequestException } from "@nestjs/common";
import { Op, Includeable } from "sequelize";
import { ReportUpdateAttributes } from "../dto/entity-update.dto";
import { SrpReportFullDto, SrpReportLightDto, SrpReportMedia } from "../dto/srp-report.dto";
import { TMLogger } from "@terramatch-microservices/common/util/tm-logger";
import { EntityCreateAttributes } from "../dto/entity-create.dto";
import { FrameworkKey } from "@terramatch-microservices/database/constants/framework";

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

export class SrpReportProcessor extends ReportProcessor<
  SrpReport,
  SrpReportLightDto,
  SrpReportFullDto,
  ReportUpdateAttributes,
  EntityCreateAttributes
> {
  readonly LIGHT_DTO = SrpReportLightDto;
  readonly FULL_DTO = SrpReportFullDto;
  private logger = new TMLogger(SrpReportProcessor.name);

  async findOne(uuid: string) {
    return await SrpReport.findOne({
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
    const builder = await this.entitiesService.buildQuery(SrpReport, query, associations);

    if (query.sort?.field != null) {
      if (
        ["title", "status", "updateRequestStatus", "createdAt", "dueAt", "updatedAt", "submittedAt", "year"].includes(
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

  async getFullDto(srpReport: SrpReport) {
    const mediaCollection = await Media.for(srpReport).findAll();
    const dto = new SrpReportFullDto(srpReport, {
      ...(this.entitiesService.mapMediaCollection(
        mediaCollection,
        SrpReport.MEDIA,
        "srpReports",
        srpReport.uuid
      ) as SrpReportMedia)
    });

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
}

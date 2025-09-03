import { DisturbanceReport } from "@terramatch-microservices/database/entities";
import { ReportProcessor } from "./entity-processor";
import { EntityQueryDto } from "../dto/entity-query.dto";
import { BadRequestException } from "@nestjs/common";
import { Op } from "sequelize";
import { ReportUpdateAttributes } from "../dto/entity-update.dto";
import { DisturbanceReportFullDto, DisturbanceReportLightDto } from "../dto/disturbance-report.dto";

const SIMPLE_FILTERS: (keyof EntityQueryDto)[] = ["status", "projectUuid", "updateRequestStatus"];

const ASSOCIATION_FIELD_MAP = {
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

  async findOne(uuid: string) {
    return await DisturbanceReport.findOne({
      where: { uuid },
      include: [
        {
          association: "project",
          attributes: ["id", "uuid", "name"]
        }
      ]
    });
  }

  async findMany(query: EntityQueryDto) {
    const builder = await this.entitiesService.buildQuery(DisturbanceReport, query, [
      { association: "project", attributes: ["uuid", "name"] }
    ]);

    if (query.sort?.field != null) {
      if (
        [
          "projectName",
          "createdAt",
          "updatedAt",
          "submittedAt",
          "dueAt",
          "status",
          "dateOfIncident",
          "intensity",
          "updateRequestStatus"
        ].includes(query.sort.field)
      ) {
        builder.order([query.sort.field, query.sort.direction ?? "ASC"]);
      } else if (query.sort.field === "projectName") {
        builder.order(["project", "name", query.sort.direction ?? "ASC"]);
      } else if (query.sort.field !== "id") {
        throw new BadRequestException(`Invalid sort field: ${query.sort.field}`);
      }
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
          { title: { [Op.like]: `%${query.search}%` } }
        ]
      });
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

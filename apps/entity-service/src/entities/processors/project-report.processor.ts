import { ProjectReport } from "@terramatch-microservices/database/entities/project-report.entity";
import { EntityProcessor } from "./entity-processor";
import { AdditionalProjectReportFullProps, ProjectReportFullDto } from "../dto/project-report.dto";
import { ProjectReportLightDto } from "../dto/project-report.dto";
import { EntityQueryDto } from "../dto/entity-query.dto";
import { DocumentBuilder } from "@terramatch-microservices/common/util/json-api-builder";
import { Includeable } from "sequelize";

export class ProjectReportProcessor extends EntityProcessor<
  ProjectReport,
  ProjectReportLightDto,
  ProjectReportFullDto
> {
  readonly LIGHT_DTO = ProjectReportLightDto;
  readonly FULL_DTO = ProjectReportFullDto;

  async findOne(uuid: string) {
    return await ProjectReport.findOne({
      where: { uuid }
    });
  }

  async findMany(query: EntityQueryDto, userId?: number, permissions?: string[]) {
    const projectAssociation: Includeable = {
      association: "project",
      attributes: ["uuid", "name"],
      include: [{ association: "organisation", attributes: ["name"] }]
    };
    const associations = [projectAssociation];
    const builder = await this.entitiesService.buildQuery(ProjectReport, query, associations);
    if (query.sort != null) {
      if (["name", "status", "updateRequestStatus", "createdAt"].includes(query.sort.field)) {
        builder.order([query.sort.field, query.sort.direction ?? "ASC"]);
      }
    }

    return { models: await builder.execute(), paginationTotal: await builder.paginationTotal() };
  }

  async addFullDto(document: DocumentBuilder, model: ProjectReport) {
    const props: AdditionalProjectReportFullProps = {};
    document.addData(model.uuid, new ProjectReportFullDto(model, props));
  }

  async addLightDto(document: DocumentBuilder, model: ProjectReport) {
    document.addData(model.uuid, new ProjectReportLightDto(model));
  }
}

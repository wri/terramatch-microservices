import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { ProjectPitch } from "@terramatch-microservices/database/entities";
import { Includeable, Op } from "sequelize";
import { ProjectPitchQueryDto } from "./dto/project-pitch-query.dto";
import { PaginatedQueryBuilder } from "@terramatch-microservices/common/util/paginated-query.builder";

@Injectable()
export class ProjectPitchService {
  async getProjectPitch(uuid: string) {
    const projectPitch = await ProjectPitch.findOne({ where: { uuid } });
    if (projectPitch == null) {
      throw new NotFoundException("ProjectPitch not found");
    }
    return projectPitch;
  }

  async getProjectPitches(query: ProjectPitchQueryDto) {
    const organisationAssociation: Includeable = {
      association: "organisation",
      attributes: ["uuid", "name"]
    };
    const builder = PaginatedQueryBuilder.forNumberPage(ProjectPitch, query, [organisationAssociation]);

    if (query.search != null) {
      builder.where({
        [Op.or]: [
          { projectName: { [Op.like]: `%${query.search}%` } },
          { "$organisation.name$": { [Op.like]: `%${query.search}%` } }
        ]
      });
    }
    if (query.filter != null) {
      Object.entries(query.filter).forEach(([key, value]) => {
        if (!["restorationInterventionTypes", "projectCountry"].includes(key)) {
          throw new BadRequestException(`Invalid filter key: ${key}`);
        }
        builder.where({
          [key]: { [Op.like]: `%${value}%` }
        });
      });
    }
    if (query.sort?.field != null) {
      if (
        ["id", "organisationId", "projectName", "projectCountry", "restorationInterventionTypes", "createdAt"].includes(
          query.sort.field
        )
      ) {
        builder.order([query.sort.field, query.sort.direction ?? "ASC"]);
      } else {
        throw new BadRequestException(`Invalid sort field: ${query.sort.field}`);
      }
    }
    return {
      data: await builder.execute(),
      paginationTotal: await builder.paginationTotal(),
      pageNumber: query.page?.number ?? 1
    };
  }
}

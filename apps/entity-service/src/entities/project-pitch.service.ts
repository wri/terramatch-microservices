import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { ProjectPitch } from "@terramatch-microservices/database/entities";
import { Includeable, Op } from "sequelize";
import { PaginatedQueryBuilder } from "@terramatch-microservices/database/util/paginated-query.builder";
import { MAX_PAGE_SIZE } from "./entities.service";
import { ProjectPitchQueryDto } from "./dto/project-pitch-query.dto";

@Injectable()
export class ProjectPitchService {
  async getProjectPitch(uuid: string) {
    const projectPitch = await ProjectPitch.findOne({ where: { uuid } });
    if (!projectPitch) {
      throw new NotFoundException("ProjectPitch not found");
    }
    return projectPitch;
  }

  async getProjectPitches(query: ProjectPitchQueryDto) {
    const pageNumber = query.page ? query.page.number : 1;
    const pageSize = query.page ? query.page.size : MAX_PAGE_SIZE;
    const organisationAssociation: Includeable = {
      association: "organisation",
      attributes: ["uuid", "name"]
    };
    const builder = new PaginatedQueryBuilder(ProjectPitch, pageSize, [organisationAssociation]);
    if (pageNumber > 1) {
      builder.pageNumber(pageNumber);
    }

    if (query.search) {
      builder.where({
        [Op.or]: [
          { projectName: { [Op.like]: `%${query.search}%` } },
          { "$organisation.name$": { [Op.like]: `%${query.search}%` } }
        ]
      });
    }
    if (query.filter) {
      Object.keys(query.filter).forEach(key => {
        if (!["restoration_intervention_types", "project_country"].includes(key)) {
          throw new BadRequestException(`Invalid filter key: ${key}`);
        }
        const value = query.filter[key];
        builder.where({
          [key]: { [Op.like]: `%${value}%` }
        });
      });
    }
    if (query.sort != null) {
      if (
        [
          "id",
          "organisation_id",
          "project_name",
          "project_objectives",
          "project_country",
          "project_county_district",
          "restoration_intervention_types",
          "total_hectares",
          "total_trees",
          "capacity_building_needs",
          "created_at",
          "updated_at",
          "deleted_at"
        ].includes(query.sort.field)
      ) {
        builder.order([query.sort.field, query.sort.direction ?? "ASC"]);
      } else {
        throw new BadRequestException(`Invalid sort field: ${query.sort.field}`);
      }
    }
    return { data: await builder.execute(), paginationTotal: await builder.paginationTotal(), pageNumber };
  }
}

import { Injectable } from "@nestjs/common";
import { ProjectPitch, User } from "@terramatch-microservices/database/entities";
import { Includeable, Op } from "sequelize";
import { ProjectsPitchesParamDto } from "./dto/projects-pitches-param.dto";
import { PaginatedQueryBuilder } from "@terramatch-microservices/database/util/paginated-query.builder";
import { MAX_PAGE_SIZE } from "./entities.service";

@Injectable()
export class ProjectPitchService {
  async getProjectPitch(uuid: string): Promise<ProjectPitch> {
    return await ProjectPitch.findOne({ where: { uuid } });
  }

  async getProjectPitches(userId: string, params: ProjectsPitchesParamDto) {
    const user = await User.findOne({
      include: ["roles", "organisations", "frameworks"],
      where: { id: userId }
    });
    const pageNumber = params.pageNumber ?? 1;
    const pageSize = params.pageSize ?? MAX_PAGE_SIZE;
    const organisationAssociation: Includeable = {
      association: "organisation",
      attributes: ["uuid", "name"]
    };
    const builder = new PaginatedQueryBuilder(ProjectPitch, pageSize, [organisationAssociation]);
    if (pageNumber > 1) {
      builder.pageNumber(pageNumber);
    }

    if (params.search) {
      builder.where({
        [Op.or]: [
          { projectName: { [Op.like]: `%${params.search}%` } },
          { "$organisation.name$": { [Op.like]: `%${params.search}%` } }
        ]
      });
    }

    builder.where({
      organisationId: {
        [Op.in]: user.organisations.map(org => org.uuid)
      }
    });

    return { data: await builder.execute(), paginationTotal: await builder.paginationTotal(), pageNumber };
  }

  async getAdminProjectPitches(params: ProjectsPitchesParamDto) {
    const pageNumber = params.pageNumber ?? 1;
    const pageSize = params.pageSize ?? MAX_PAGE_SIZE;
    const organisationAssociation: Includeable = {
      association: "organisation",
      attributes: ["uuid", "name"]
    };
    const builder = new PaginatedQueryBuilder(ProjectPitch, pageSize, [organisationAssociation]);
    if (pageNumber > 1) {
      builder.pageNumber(pageNumber);
    }

    if (params.search) {
      builder.where({
        [Op.or]: [
          { projectName: { [Op.like]: `%${params.search}%` } },
          { "$organisation.name$": { [Op.like]: `%${params.search}%` } }
        ]
      });
    }
    return { data: await builder.execute(), paginationTotal: await builder.paginationTotal(), pageNumber };
  }
}

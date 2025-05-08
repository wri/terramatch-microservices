import { Injectable, NotFoundException } from "@nestjs/common";
import { ProjectPitch, User } from "@terramatch-microservices/database/entities";
import { Includeable, Op } from "sequelize";
import { PaginatedQueryBuilder } from "@terramatch-microservices/database/util/paginated-query.builder";
import { MAX_PAGE_SIZE } from "./entities.service";
import { EntityQueryDto } from "./dto/entity-query.dto";

@Injectable()
export class ProjectPitchService {
  async getProjectPitch(uuid: string) {
    const projectPitch = await ProjectPitch.findOne({ where: { uuid } });
    if (!projectPitch) {
      throw new NotFoundException("ProjectPitch not found");
    }
    return projectPitch;
  }

  async getProjectPitches(userId: number, params: EntityQueryDto) {
    const user = await User.findOne({
      include: ["organisations"],
      where: { id: userId }
    });

    if (!user) {
      throw new NotFoundException("User not found");
    }

    const pageNumber = params.page ? params.page.number : 1;
    const pageSize = params.page ? params.page.size : MAX_PAGE_SIZE;
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

  async getAdminProjectPitches(params: EntityQueryDto) {
    const pageNumber = params.page ? params.page.number : 1;
    const pageSize = params.page ? params.page.size : MAX_PAGE_SIZE;
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

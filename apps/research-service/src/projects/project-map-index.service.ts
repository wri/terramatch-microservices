import { Injectable } from "@nestjs/common";
import { Op } from "sequelize";
import { Project } from "@terramatch-microservices/database/entities";
import { projectContextIdsSubquery } from "../site-polygons/project-context-filters";
import { ProjectMapIndexQueryDto } from "./dto/project-map-index-query.dto";
import { ProjectMapIndexDto } from "./dto/project-map-index.dto";

@Injectable()
export class ProjectMapIndexService {
  async getMapIndex(query: ProjectMapIndexQueryDto) {
    const projects = await Project.findAll({
      attributes: ["uuid", "name", "lat", "long"],
      where: { id: { [Op.in]: projectContextIdsSubquery(query, true) } }
    });

    return new ProjectMapIndexDto(projects.map(({ uuid, name, lat, long }) => ({ uuid, name, lat, long })));
  }
}

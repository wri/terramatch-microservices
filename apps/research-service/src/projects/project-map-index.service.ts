import { Injectable } from "@nestjs/common";
import { col, fn, Op } from "sequelize";
import { Project, SitePolygon } from "@terramatch-microservices/database/entities";
import { projectContextIdsSubquery } from "../site-polygons/project-context-filters";
import { ProjectMapIndexQueryDto } from "./dto/project-map-index-query.dto";
import { ProjectMapIndexDto } from "./dto/project-map-index.dto";

type PolygonCountRow = { projectId: number; count: number | string };

const countActivePolygonsByProject = async (projectIds: ReturnType<typeof projectContextIdsSubquery>) => {
  const rows = (await SitePolygon.findAll({
    attributes: [
      [col("site.project_id"), "projectId"],
      [fn("COUNT", col("SitePolygon.id")), "count"]
    ],
    include: [{ association: "site", attributes: [], required: true, where: { projectId: { [Op.in]: projectIds } } }],
    where: { isActive: true },
    group: ["site.project_id"],
    raw: true
  })) as unknown as PolygonCountRow[];
  return new Map(rows.map(({ projectId, count }) => [Number(projectId), Number(count)]));
};

@Injectable()
export class ProjectMapIndexService {
  async getMapIndex(query: ProjectMapIndexQueryDto) {
    const projectIds = projectContextIdsSubquery(query, true);
    const [projects, polygonCounts] = await Promise.all([
      Project.findAll({
        attributes: ["id", "uuid", "name", "lat", "long", "frameworkKey", "level0Project", "cohort"],
        where: { id: { [Op.in]: projectIds } }
      }),
      countActivePolygonsByProject(projectIds)
    ]);

    return new ProjectMapIndexDto(
      projects.map(({ id, uuid, name, lat, long, frameworkKey, level0Project, cohort }) => ({
        uuid,
        name,
        lat,
        long,
        frameworkKey,
        level0Project,
        cohort,
        polygonCount: polygonCounts.get(id) ?? 0
      }))
    );
  }
}

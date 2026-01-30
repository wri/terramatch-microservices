import { Injectable } from "@nestjs/common";
import { Project, Framework } from "@terramatch-microservices/database/entities";
import { FrameworkKey } from "@terramatch-microservices/database/constants";
import { Op } from "sequelize";
import { DashboardQueryDto } from "./dto/dashboard-query.dto";
import { DashboardProjectsQueryBuilder } from "./dashboard-query.builder";

export interface DashboardFrameworkItem {
  framework_slug: string;
  name: string;
}

/**
 * Returns the list of frameworks that have at least one project matching the dashboard
 * filters (same semantics as dashboard project list). Used for programme/framework dropdowns.
 */
@Injectable()
export class DashboardFrameworksService {
  async getFrameworks(query: DashboardQueryDto): Promise<DashboardFrameworkItem[]> {
    const builder = new DashboardProjectsQueryBuilder(Project, [
      {
        association: "organisation",
        attributes: ["uuid", "name", "type"]
      }
    ]).queryFilters(query);

    const rows = await builder.select(["frameworkKey"]);
    const keys: FrameworkKey[] = [
      ...new Set(rows.map(r => r.frameworkKey).filter((k): k is FrameworkKey => k != null))
    ];
    if (keys.length === 0) return [];

    const frameworks = await Framework.findAll({
      where: { slug: { [Op.in]: keys } },
      attributes: ["slug", "name"]
    });

    return frameworks
      .map(f => ({ framework_slug: f.slug ?? "", name: f.name }))
      .filter(f => f.framework_slug !== "")
      .sort((a, b) => a.name.localeCompare(b.name));
  }
}

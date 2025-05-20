import { Injectable } from "@nestjs/common";
import { Project } from "@terramatch-microservices/database/entities";
import { Includeable } from "sequelize";
import { DashboardQueryDto } from "./dto/dashboard-query.dto";
import { DashboardProjectsQueryBuilder } from "./dashboard-query.builder";

@Injectable()
export class DashboardService {
  async buildQuery(filters: DashboardQueryDto, include?: Includeable[]) {
    const builder = new DashboardProjectsQueryBuilder(Project, include);
    builder.queryFilters(filters);
    return builder;
  }

  async getAllProjects(filters: DashboardQueryDto, include?: Includeable[]) {
    const builder = await this.buildQuery(filters, include);
    return builder.execute();
  }

  async countProjects(filters: DashboardQueryDto, include?: Includeable[]) {
    const builder = await this.buildQuery(filters, include);
    return builder.count();
  }

  async sumProjectsField(filters: DashboardQueryDto, field: keyof Project, include?: Includeable[]) {
    const builder = await this.buildQuery(filters, include);
    return builder.sum(field);
  }

  async getProjectIds(filters: DashboardQueryDto, include?: Includeable[]) {
    const builder = await this.buildQuery(filters, include);
    return builder.pluckIds();
  }
}

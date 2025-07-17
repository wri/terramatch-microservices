import { Injectable } from "@nestjs/common";
import { DashboardEntityProcessor } from "./processors/dashboard-entity-processor";
import { DashboardProjectsProcessor } from "./processors/dashboard-projects.processor";
import { CacheService } from "./dto/cache.service";
import { Project } from "@terramatch-microservices/database/entities";
import { DashboardEntityDto } from "./dto/dashboard-entity.dto";
import { DashboardEntity } from "@terramatch-microservices/database/constants";
import { PolicyService } from "@terramatch-microservices/common";

export const DASHBOARD_PROCESSORS = {
  dashboardProjects: DashboardProjectsProcessor
} as const;

@Injectable()
export class DashboardEntitiesService {
  constructor(private readonly cacheService: CacheService, private readonly policyService: PolicyService) {}

  createDashboardProcessor<T extends Project>(
    entity: DashboardEntity
  ): DashboardEntityProcessor<T, DashboardEntityDto, DashboardEntityDto> {
    const processorClass = DASHBOARD_PROCESSORS[entity];

    return new processorClass(this.cacheService, this.policyService) as unknown as DashboardEntityProcessor<
      T,
      DashboardEntityDto,
      DashboardEntityDto
    >;
  }

  getCacheService(): CacheService {
    return this.cacheService;
  }
}

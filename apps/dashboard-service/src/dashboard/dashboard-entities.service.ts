import { Injectable, BadRequestException } from "@nestjs/common";
import { DashboardEntityProcessor } from "./processors/dashboard-entity-processor";
import { DashboardProjectsProcessor } from "./processors/dashboard-projects.processor";
import { CacheService } from "./dto/cache.service";

export const DASHBOARD_PROCESSORS = {
  dashboardProjects: DashboardProjectsProcessor
} as const;

export type DashboardEntity = keyof typeof DASHBOARD_PROCESSORS;
export const DASHBOARD_ENTITIES = Object.keys(DASHBOARD_PROCESSORS) as DashboardEntity[];

@Injectable()
export class DashboardEntitiesService {
  constructor(private readonly cacheService: CacheService) {}
  createDashboardProcessor(entity: DashboardEntity): DashboardEntityProcessor<any, any, any> {
    const processorClass = DASHBOARD_PROCESSORS[entity];
    if (processorClass == null) {
      throw new BadRequestException(`Dashboard entity type invalid: ${entity}`);
    }

    return new processorClass(this.cacheService) as unknown as DashboardEntityProcessor<any, any, any>;
  }
  getCacheService(): CacheService {
    return this.cacheService;
  }
}

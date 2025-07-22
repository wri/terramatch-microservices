import { Injectable } from "@nestjs/common";
import { DashboardEntityProcessor } from "./processors/dashboard-entity-processor";
import { DashboardProjectsProcessor } from "./processors/dashboard-projects.processor";
import { DashboardSitePolygonsProcessor } from "./processors/dashboard-sitepolygons.processor";
import { CacheService } from "./dto/cache.service";
import { Project } from "@terramatch-microservices/database/entities";
import { DashboardEntityDto } from "./dto/dashboard-entity.dto";
import { PolicyService } from "@terramatch-microservices/common";
import { DASHBOARD_ENTITIES } from "./constants/dashboard-entities.constants";

export const DASHBOARD_PROCESSORS = {
  [DASHBOARD_ENTITIES[0]]: DashboardProjectsProcessor,
  [DASHBOARD_ENTITIES[1]]: DashboardSitePolygonsProcessor
} as const;

type DashboardEntityKey = keyof typeof DASHBOARD_PROCESSORS;

@Injectable()
export class DashboardEntitiesService {
  constructor(private readonly cacheService: CacheService, private readonly policyService: PolicyService) {}

  createDashboardProcessor<T extends Project>(
    entity: DashboardEntityKey
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

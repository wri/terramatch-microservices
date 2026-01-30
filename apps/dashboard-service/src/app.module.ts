import { Module } from "@nestjs/common";
import { CommonModule } from "@terramatch-microservices/common";
import { SentryModule } from "@sentry/nestjs/setup";
import { APP_FILTER } from "@nestjs/core";
import { HealthModule } from "@terramatch-microservices/common/health/health.module";
import { TotalSectionHeaderController } from "./dashboard/total-section-header.controller";
import { TotalSectionHeaderService } from "./dashboard/dto/total-section-header.service";
import { BullModule } from "@nestjs/bullmq";
import { CacheService } from "./dashboard/dto/cache.service";
import { RedisModule } from "@nestjs-modules/ioredis";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { DashboardProcessor } from "./dashboard/worker/dashboard.processor";
import { TreeRestorationGoalController } from "./dashboard/tree-restoration-goal.controller";
import { TreeRestorationGoalService } from "./dashboard/dto/tree-restoration-goal.service";
import { TotalJobsCreatedController } from "./dashboard/total-jobs-created.controller";
import { TotalJobsCreatedService } from "./dashboard/total-jobs-created.service";
import { ScheduleModule } from "@nestjs/schedule";
import { DashboardCacheWarmupService } from "./dashboard/warmup/dashboard-cache-warmup.service";
import { DashboardEntitiesController } from "./dashboard/dashboard-entities.controller";
import { DashboardEntitiesService } from "./dashboard/dashboard-entities.service";
import { HectaresRestorationService } from "./dashboard/hectares-restoration.service";
import { HectaresRestorationController } from "./dashboard/hectares-restoration.controller";
import { UserContextInterceptor } from "./dashboard/interceptors/user-context.interceptor";
import { DashboardProjectsController } from "./dashboard/dashboard-projects.controller";
import { DashboardProjectsService } from "./dashboard/dashboard-projects.service";
import { DashboardSitePolygonsController } from "./dashboard/dashboard-sitepolygons.controller";
import { DashboardSitePolygonsService } from "./dashboard/dashboard-sitepolygons.service";
import { DashboardFrameworksController } from "./dashboard/dashboard-frameworks.controller";
import { DashboardFrameworksService } from "./dashboard/dashboard-frameworks.service";
import { DashboardImpactStoryService } from "./dashboard/dashboard-impact-story.service";
import { TMGlobalFilter } from "@terramatch-microservices/common/util/tm-global-filter";

@Module({
  imports: [
    SentryModule.forRoot(),
    CommonModule,
    HealthModule,
    ConfigModule.forRoot({ isGlobal: true }),
    RedisModule.forRootAsync({
      imports: [ConfigModule.forRoot({ isGlobal: true })],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const protocol = process.env["NODE_ENV"] === "development" ? "redis://" : "rediss://";
        return {
          type: "single",
          url: `${protocol}${configService.get("REDIS_HOST")}:${configService.get("REDIS_PORT")}`
        };
      }
    }),
    BullModule.registerQueue({ name: "dashboard" }),
    ...(process.env.REPL === "true" ? [] : [ScheduleModule.forRoot()])
  ],
  controllers: [
    TotalSectionHeaderController,
    TreeRestorationGoalController,
    TotalJobsCreatedController,
    HectaresRestorationController,
    DashboardFrameworksController,
    DashboardEntitiesController,
    DashboardProjectsController,
    DashboardSitePolygonsController
  ],
  providers: [
    { provide: APP_FILTER, useClass: TMGlobalFilter },
    TotalSectionHeaderService,
    CacheService,
    DashboardProcessor,
    TreeRestorationGoalService,
    TotalJobsCreatedService,
    DashboardCacheWarmupService,
    DashboardEntitiesService,
    HectaresRestorationService,
    UserContextInterceptor,
    DashboardProjectsService,
    DashboardFrameworksService,
    DashboardSitePolygonsService,
    DashboardImpactStoryService
  ]
})
export class AppModule {}

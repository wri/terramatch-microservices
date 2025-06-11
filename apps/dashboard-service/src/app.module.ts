import { Module } from "@nestjs/common";
import { CommonModule } from "@terramatch-microservices/common";
import { SentryGlobalFilter, SentryModule } from "@sentry/nestjs/setup";
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
    BullModule.registerQueue({ name: "dashboard" })
  ],
  controllers: [TotalSectionHeaderController, TreeRestorationGoalController],
  providers: [
    {
      provide: APP_FILTER,
      useClass: SentryGlobalFilter
    },
    TotalSectionHeaderService,
    CacheService,
    DashboardProcessor,
    TreeRestorationGoalService
  ]
})
export class AppModule {}

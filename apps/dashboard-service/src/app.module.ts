import { Module } from "@nestjs/common";
import { CommonModule } from "@terramatch-microservices/common";
import { SentryGlobalFilter, SentryModule } from "@sentry/nestjs/setup";
import { APP_FILTER } from "@nestjs/core";
import { HealthModule } from "@terramatch-microservices/common/health/health.module";
import { TotalSectionHeaderController } from "./dashboard/total-section-header.controller";
import { TotalSectionHeaderService } from "./dashboard/dto/total-section-header.service";
import { BullModule } from "@nestjs/bullmq";
import { CacheService } from "./dashboard/dto/cache.service";
import { WorkerProcessor } from "./dashboard/worker/worker.processor";
import { RedisModule } from "@nestjs-modules/ioredis";
import { DashboardService } from "./dashboard/dashboard.service";

@Module({
  imports: [
    SentryModule.forRoot(),
    CommonModule,
    HealthModule,
    RedisModule.forRoot({
      type: "single",
      url: "redis://127.0.0.1:6379"
    }),
    BullModule.registerQueue({ name: "dashboard" })
  ],
  controllers: [TotalSectionHeaderController],
  providers: [
    {
      provide: APP_FILTER,
      useClass: SentryGlobalFilter
    },
    TotalSectionHeaderService,
    CacheService,
    WorkerProcessor,
    DashboardService
  ]
})
export class AppModule {}

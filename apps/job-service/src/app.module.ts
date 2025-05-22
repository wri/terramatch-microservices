import { Module } from "@nestjs/common";
import { CommonModule } from "@terramatch-microservices/common";
import { DelayedJobsController } from "./jobs/delayed-jobs.controller";
import { SentryGlobalFilter, SentryModule } from "@sentry/nestjs/setup";
import { APP_FILTER } from "@nestjs/core";
import { HealthModule } from "@terramatch-microservices/common/health/health.module";
import { ScheduleModule } from "@nestjs/schedule";
import { ScheduledJobsService } from "./scheduled-jobs/scheduled-jobs.service";
import { BullModule } from "@nestjs/bullmq";

@Module({
  imports: [
    SentryModule.forRoot(),
    ScheduleModule.forRoot(),
    BullModule.registerQueue({ name: "scheduled-jobs" }),
    CommonModule,
    HealthModule
  ],
  controllers: [DelayedJobsController],
  providers: [ScheduledJobsService, { provide: APP_FILTER, useClass: SentryGlobalFilter }]
})
export class AppModule {}

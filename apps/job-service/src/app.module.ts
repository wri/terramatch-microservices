import { Module } from "@nestjs/common";
import { CommonModule } from "@terramatch-microservices/common";
import { DelayedJobsController } from "./jobs/delayed-jobs.controller";
import { SentryGlobalFilter, SentryModule } from "@sentry/nestjs/setup";
import { APP_FILTER } from "@nestjs/core";
import { HealthModule } from "@terramatch-microservices/common/health/health.module";
import { ScheduleModule } from "@nestjs/schedule";
import { ScheduledJobsService } from "./scheduled-jobs/scheduled-jobs.service";
import { BullModule } from "@nestjs/bullmq";
import { ScheduledJobsProcessor } from "./scheduled-jobs/scheduled-jobs.processor";
import { DelayedJobsService } from "./jobs/delayed-jobs.service";

@Module({
  imports: [
    SentryModule.forRoot(),
    ...(process.env.REPL === "true" ? [] : [ScheduleModule.forRoot()]),
    BullModule.registerQueue({ name: "scheduled-jobs" }),
    BullModule.registerQueue({ name: "email" }),
    CommonModule,
    HealthModule
  ],
  controllers: [DelayedJobsController],
  providers: [
    { provide: APP_FILTER, useClass: SentryGlobalFilter },
    ScheduledJobsService,
    ScheduledJobsProcessor,
    DelayedJobsService
  ]
})
export class AppModule {}

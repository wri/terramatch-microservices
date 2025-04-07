import { Module } from "@nestjs/common";
import { CommonModule } from "@terramatch-microservices/common";
import { DelayedJobsController } from "./jobs/delayed-jobs.controller";
import { HealthModule } from "./health/health.module";
import { SentryGlobalFilter, SentryModule } from "@sentry/nestjs/setup";
import { APP_FILTER } from "@nestjs/core";

@Module({
  imports: [SentryModule.forRoot(), CommonModule, HealthModule],
  controllers: [DelayedJobsController],
  providers: [
    {
      provide: APP_FILTER,
      useClass: SentryGlobalFilter
    }
  ]
})
export class AppModule {}

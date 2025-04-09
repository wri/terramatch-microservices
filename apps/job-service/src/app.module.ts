import { Module } from "@nestjs/common";
import { CommonModule } from "@terramatch-microservices/common";
import { DelayedJobsController } from "./jobs/delayed-jobs.controller";
import { SentryGlobalFilter, SentryModule } from "@sentry/nestjs/setup";
import { APP_FILTER } from "@nestjs/core";
import { HealthModule } from "@terramatch-microservices/common/health/health.module";

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

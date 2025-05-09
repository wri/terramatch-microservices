import { Module } from "@nestjs/common";
import { CommonModule } from "@terramatch-microservices/common";
import { SentryGlobalFilter, SentryModule } from "@sentry/nestjs/setup";
import { APP_FILTER } from "@nestjs/core";
import { HealthModule } from "@terramatch-microservices/common/health/health.module";
import { TotalSectionHeaderController } from "./dashboard/total-section-header.controller";
import { TotalSectionHeaderService } from "./dashboard/dto/total-section-header.service";

@Module({
  imports: [SentryModule.forRoot(), CommonModule, HealthModule],
  controllers: [TotalSectionHeaderController],
  providers: [
    {
      provide: APP_FILTER,
      useClass: SentryGlobalFilter
    },
    TotalSectionHeaderService
  ]
})
export class AppModule {}

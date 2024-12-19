import { Module } from "@nestjs/common";
import { DatabaseModule } from "@terramatch-microservices/database";
import { CommonModule } from "@terramatch-microservices/common";
import { HealthModule } from "./health/health.module";
import { TreesController } from "./trees/trees.controller";
import { TreeService } from "./trees/tree.service";
import { SentryGlobalFilter, SentryModule } from "@sentry/nestjs/setup";
import { APP_FILTER } from "@nestjs/core";

@Module({
  imports: [SentryModule.forRoot(), DatabaseModule, CommonModule, HealthModule],
  controllers: [TreesController],
  providers: [
    {
      provide: APP_FILTER,
      useClass: SentryGlobalFilter
    },
    TreeService
  ]
})
export class AppModule {}

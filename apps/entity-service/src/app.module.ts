import { Module } from "@nestjs/common";
import { DatabaseModule } from "@terramatch-microservices/database";
import { CommonModule } from "@terramatch-microservices/common";
import { HealthModule } from "./health/health.module";
import { TreesController } from "./trees/trees.controller";
import { TreeService } from "./trees/tree.service";
import { SentryGlobalFilter, SentryModule } from "@sentry/nestjs/setup";
import { APP_FILTER } from "@nestjs/core";
import { EntitiesService } from "./entities/entities.service";
import { EntitiesController } from "./entities/entities.controller";
import { EntityAssociationsController } from "./entities/entity-associations.controller";
import { PdfProcessor } from "./entities/processors/pdf.processor";

@Module({
  imports: [SentryModule.forRoot(), DatabaseModule, CommonModule, HealthModule],
  controllers: [EntitiesController, EntityAssociationsController, TreesController],
  providers: [
    {
      provide: APP_FILTER,
      useClass: SentryGlobalFilter
    },
    EntitiesService,
    TreeService,
    PdfProcessor
  ]
})
export class AppModule {}

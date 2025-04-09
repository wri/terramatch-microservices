import { Module } from "@nestjs/common";
import { CommonModule } from "@terramatch-microservices/common";
import { TreesController } from "./trees/trees.controller";
import { TreeService } from "./trees/tree.service";
import { SentryGlobalFilter, SentryModule } from "@sentry/nestjs/setup";
import { APP_FILTER } from "@nestjs/core";
import { EntitiesService } from "./entities/entities.service";
import { EntitiesController } from "./entities/entities.controller";
import { EntityAssociationsController } from "./entities/entity-associations.controller";
import { HealthModule } from "@terramatch-microservices/common/health/health.module";

@Module({
  imports: [SentryModule.forRoot(), CommonModule, HealthModule],
  controllers: [EntitiesController, EntityAssociationsController, TreesController],
  providers: [
    {
      provide: APP_FILTER,
      useClass: SentryGlobalFilter
    },
    EntitiesService,
    TreeService
  ]
})
export class AppModule {}

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
import { FileUploadController } from "./entities/file-upload.controller";
import { FileUploadService } from "./trees/file-upload.service";
import { ProjectPitchesController } from "./entities/project-pitches.controller";
import { ProjectPitchService } from "./entities/project-pitch.service";
import { TasksController } from "./entities/tasks.controller";
import { TasksService } from "./entities/tasks.service";

@Module({
  imports: [SentryModule.forRoot(), CommonModule, HealthModule],
  // Note: Any controller that provides a path under the entities namespace ("entities/v3/something")
  // needs to be provided in this list before EntitiesController, or it will be superseded by the
  // wildcard route on EntitiesController.
  controllers: [
    ProjectPitchesController,
    TasksController,
    FileUploadController,
    EntitiesController,
    EntityAssociationsController,
    TreesController
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: SentryGlobalFilter
    },
    EntitiesService,
    TreeService,
    FileUploadService,
    ProjectPitchService,
    TasksService
  ]
})
export class AppModule {}

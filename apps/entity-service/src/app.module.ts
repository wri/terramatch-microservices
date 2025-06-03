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
import { FileUploadService } from "./file/file-upload.service";
import { ProjectPitchesController } from "./entities/project-pitches.controller";
import { ProjectPitchService } from "./entities/project-pitch.service";
import { TasksController } from "./entities/tasks.controller";
import { TasksService } from "./entities/tasks.service";
import { BoundingBoxController } from "./bounding-boxes/bounding-box.controller";
import { BoundingBoxService } from "./bounding-boxes/bounding-box.service";
import { DataApiModule } from "@terramatch-microservices/data-api";

@Module({
  imports: [SentryModule.forRoot(), CommonModule, HealthModule, DataApiModule],
  // Note: Any controller that provides a path under the entities namespace ("entities/v3/something")
  // needs to be provided in this list before EntitiesController, or it will be superseded by the
  // wildcard route on EntitiesController.
  controllers: [
    ProjectPitchesController,
    TasksController,
    FileUploadController,
    TreesController,
    BoundingBoxController,
    EntitiesController,
    EntityAssociationsController
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
    BoundingBoxService,
    TasksService
  ]
})
export class AppModule {}

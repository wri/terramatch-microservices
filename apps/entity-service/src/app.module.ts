import { Module } from "@nestjs/common";
import { CommonModule } from "@terramatch-microservices/common";
import { TreesController } from "./trees/trees.controller";
import { TreeService } from "./trees/tree.service";
import { SentryModule } from "@sentry/nestjs/setup";
import { APP_FILTER } from "@nestjs/core";
import { EntitiesService } from "./entities/entities.service";
import { EntitiesController } from "./entities/entities.controller";
import { EntityAssociationsController } from "./entities/entity-associations.controller";
import { HealthModule } from "@terramatch-microservices/common/health/health.module";
import { FilesController } from "./entities/files.controller";
import { ProjectPitchesController } from "./entities/project-pitches.controller";
import { ProjectPitchService } from "./entities/project-pitch.service";
import { TasksController } from "./entities/tasks.controller";
import { TasksService } from "./entities/tasks.service";
import { DemographicsController } from "./entities/demographics.controller";
import { DemographicService } from "./entities/demographic.service";
import { ImpactStoriesController } from "./entities/impact-stories.controller";
import { ImpactStoryService } from "./entities/impact-story.service";
import { DisturbancesController } from "./entities/disturbances.controller";
import { DisturbanceService } from "./entities/disturbance.service";
import { OptionLabelsController } from "./forms/option-labels.controller";
import { LinkedFieldsController } from "./forms/linked-fields.controller";
import { FormsController } from "./forms/forms.controller";
import { FormsService } from "./forms/forms.service";
import { FormDataController } from "./entities/form-data.controller";
import { FormDataService } from "./entities/form-data.service";
import { UpdateRequestsController } from "./entities/update-requests.controller";
import { ApplicationsController } from "./applications/applications.controller";
import { SubmissionsController } from "./forms/submissions.controller";
import { FundingProgrammesController } from "./fundingProgrammes/funding-programmes.controller";
import { TMGlobalFilter } from "@terramatch-microservices/common/util/tm-global-filter";
import { BullModule } from "@nestjs/bullmq";
import { EntitiesQueueProcessor } from "./entities/queue/entities-queue.processor";
import { AuditStatusController } from "./entities/audit-status.controller";
import { AuditStatusService } from "./entities/audit-status.service";

@Module({
  imports: [
    SentryModule.forRoot(),
    CommonModule,
    HealthModule,
    BullModule.registerQueue({ name: "email" }),
    BullModule.registerQueue({ name: "entities" })
  ],
  // Note: Any controller that provides a path under the entities namespace ("entities/v3/something")
  // needs to be provided in this list before EntitiesController, or it will be superseded by the
  // wildcard route on EntitiesController.
  controllers: [
    ProjectPitchesController,
    ImpactStoriesController,
    TasksController,
    FilesController,
    TreesController,
    DemographicsController,
    DisturbancesController,
    AuditStatusController, // must be before EntitiesController
    EntitiesController,
    FormDataController, // must be before entity association controller.
    UpdateRequestsController, // must be before entity association controller.
    EntityAssociationsController,
    OptionLabelsController, // must be before forms controller
    LinkedFieldsController, // must be before forms controller
    SubmissionsController, // must be before forms controller
    FormsController,
    ApplicationsController,
    FundingProgrammesController
  ],
  providers: [
    { provide: APP_FILTER, useClass: TMGlobalFilter },
    EntitiesService,
    TreeService,
    ProjectPitchService,
    ImpactStoryService,
    TasksService,
    DemographicService,
    DisturbanceService,
    AuditStatusService,
    FormsService,
    FormDataService,
    EntitiesQueueProcessor
  ]
})
export class AppModule {}

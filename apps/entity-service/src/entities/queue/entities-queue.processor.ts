import { InjectQueue, Processor, WorkerHost } from "@nestjs/bullmq";
import { Job, Queue } from "bullmq";
import { EntitiesService } from "../entities.service";
import { isNumber } from "lodash";
import { InternalServerErrorException, NotImplementedException } from "@nestjs/common";
import { Application, FormSubmission } from "@terramatch-microservices/database/entities";
import { FormSubmissionFeedbackEmail } from "@terramatch-microservices/common/email/form-submission-feedback.email";
import { FrameworkKey } from "@terramatch-microservices/database/constants";
import { EntityType } from "@terramatch-microservices/database/constants/entities";

export const CREATE_PROJECT_FOR_APPLICATION = "createProjectForApplication";
export const GENERATE_FRAMEWORK_ENTITY_EXPORT = "generateFrameworkEntityExport";

@Processor("entities")
export class EntitiesQueueProcessor extends WorkerHost {
  constructor(
    private readonly entitiesService: EntitiesService,
    @InjectQueue("email") private readonly emailQueue: Queue
  ) {
    super();
  }

  async process(job: Job) {
    const { name, data } = job;
    if (name === CREATE_PROJECT_FOR_APPLICATION) {
      const { applicationId } = data;
      if (!isNumber(applicationId)) {
        throw new InternalServerErrorException(`Invalid applicationId: ${JSON.stringify(data)}`);
      }
      await this.createProjectForApplication(data.applicationId);
    } else if (name === GENERATE_FRAMEWORK_ENTITY_EXPORT) {
      const { frameworkKey, entityType } = data as { frameworkKey: FrameworkKey; entityType: EntityType };
      if (frameworkKey == null || entityType == null) {
        throw new InternalServerErrorException(`Invalid frameworkKey or entityType: ${JSON.stringify(data)}`);
      }
      await this.generateEntityFrameworkExport(frameworkKey, entityType);
    } else {
      throw new NotImplementedException(
        `Received unknown job ${name} with data ${JSON.stringify(data)} in entities queue.`
      );
    }
  }

  private async createProjectForApplication(applicationId: number) {
    const application = await Application.findByPk(applicationId, {
      attributes: ["uuid"],
      include: [
        {
          association: "fundingProgramme",
          include: [{ association: "framework", attributes: ["slug", "projectFormUuid"] }]
        }
      ]
    });
    if (application == null) {
      throw new InternalServerErrorException(`Application not found for ID: ${applicationId}`);
    }
    if (application.fundingProgramme?.framework == null) {
      throw new InternalServerErrorException(
        `Application funding programme or framework not found for ID: ${applicationId}`
      );
    }
    const { slug, projectFormUuid } = application.fundingProgramme.framework;
    if (projectFormUuid == null) {
      throw new InternalServerErrorException(`Framework does not have a project form assigned: ${slug}`);
    }

    const submission = await FormSubmission.application(applicationId).findOne({
      order: [["id", "DESC"]],
      attributes: ["id"]
    });
    if (submission == null) {
      throw new InternalServerErrorException(`Application does not have a form submission: ${applicationId}`);
    }

    const project = await this.entitiesService
      .createEntityProcessor("projects")
      .create({ applicationUuid: application.uuid, formUuid: projectFormUuid });

    await new FormSubmissionFeedbackEmail({ submissionId: submission.id, projectUuid: project.uuid }).sendLater(
      this.emailQueue
    );
  }

  private async generateEntityFrameworkExport(frameworkKey: FrameworkKey, entityType: EntityType) {
    const processor = this.entitiesService.createEntityProcessor(entityType);
    await processor.exportAll({ frameworkKey });
  }
}

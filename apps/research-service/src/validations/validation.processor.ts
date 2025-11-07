import { Processor } from "@nestjs/bullmq";
import { Job } from "bullmq";
import { TMLogger } from "@terramatch-microservices/common/util/tm-logger";
import { ValidationService } from "./validation.service";
import { ValidationType } from "@terramatch-microservices/database/constants";
import {
  DelayedJobException,
  DelayedJobWorker
} from "@terramatch-microservices/common/workers/delayed-job-worker.processor";
import { ValidationSummaryDto } from "./dto/validation-summary.dto";
import { buildJsonApi } from "@terramatch-microservices/common/util";
import { populateDto } from "@terramatch-microservices/common/dto/json-api-attributes";

export interface SiteValidationJobData {
  siteUuid: string;
  validationTypes: ValidationType[];
  delayedJobId: number;
}

const KEEP_JOBS_TIMEOUT = 60 * 60; // keep jobs for 1 hour after completion (instead of default of forever)
@Processor("validation", {
  concurrency: 100,
  removeOnComplete: { age: KEEP_JOBS_TIMEOUT },
  removeOnFail: { age: KEEP_JOBS_TIMEOUT }
})
export class ValidationProcessor extends DelayedJobWorker<SiteValidationJobData> {
  protected readonly logger = new TMLogger(ValidationProcessor.name);

  constructor(private readonly validationService: ValidationService) {
    super();
  }

  async processDelayedJob(job: Job<SiteValidationJobData>) {
    const { siteUuid, validationTypes } = job.data;

    const polygonUuids = await this.validationService.getSitePolygonUuids(siteUuid);
    if (polygonUuids.length === 0) {
      throw new DelayedJobException(404, `No polygons found for site ${siteUuid}`);
    }

    await this.updateJobProgress(job, {
      totalContent: polygonUuids.length,
      processedContent: 0,
      progressMessage: `Starting validation of ${polygonUuids.length} polygons...`
    });

    const batchSize = 50;
    let processed = 0;

    for (let i = 0; i < polygonUuids.length; i += batchSize) {
      const batch = polygonUuids.slice(i, i + batchSize);
      await this.validationService.validatePolygonsBatch(batch, validationTypes);

      processed += batch.length;
      const progressPercentage = Math.floor((processed / polygonUuids.length) * 100);
      await this.updateJobProgress(job, {
        processedContent: processed,
        progressMessage: `Running ${processed} out of ${polygonUuids.length} polygons (${progressPercentage}%)`
      });
    }

    const document = buildJsonApi(ValidationSummaryDto).addData(
      siteUuid,
      populateDto(new ValidationSummaryDto(), {
        siteUuid: siteUuid,
        totalPolygons: polygonUuids.length,
        validatedPolygons: polygonUuids.length,
        completedAt: new Date()
      })
    );
    return {
      processedContent: polygonUuids.length,
      progressMessage: `Completed validation of ${polygonUuids.length} polygons`,
      payload: document
    };
  }
}

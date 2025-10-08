import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from "bullmq";
import { TMLogger } from "@terramatch-microservices/common/util/tm-logger";
import { DelayedJob } from "@terramatch-microservices/database/entities";
import { ValidationService } from "./validation.service";
import { ValidationType } from "@terramatch-microservices/database/constants";

export interface SiteValidationJobData {
  siteUuid: string;
  validationTypes: ValidationType[];
  delayedJobId: number;
}

@Processor("validation")
export class ValidationProcessor extends WorkerHost {
  private readonly logger = new TMLogger(ValidationProcessor.name);

  constructor(private readonly validationService: ValidationService) {
    super();
  }

  async process(job: Job<SiteValidationJobData>) {
    const { siteUuid, validationTypes, delayedJobId } = job.data;
    this.logger.log(`Processing site validation job for site ${siteUuid} with types: ${validationTypes.join(", ")}`);

    try {
      // Get all polygons for the site
      const polygonUuids = await this.validationService.getSitePolygonUuids(siteUuid);

      if (polygonUuids.length === 0) {
        await DelayedJob.update(
          {
            status: "failed",
            statusCode: 404,
            payload: { error: `No polygons found for site ${siteUuid}` }
          },
          { where: { id: delayedJobId } }
        );
        return;
      }

      // Update job with total content
      await DelayedJob.update(
        {
          totalContent: polygonUuids.length,
          processedContent: 0,
          progressMessage: `Starting validation of ${polygonUuids.length} polygons...`
        },
        { where: { id: delayedJobId } }
      );

      // Process in batches to avoid memory issues
      const batchSize = 50;
      let processed = 0;

      for (let i = 0; i < polygonUuids.length; i += batchSize) {
        const batch = polygonUuids.slice(i, i + batchSize);

        this.logger.log(
          `Processing batch ${Math.floor(i / batchSize) + 1} of ${Math.ceil(polygonUuids.length / batchSize)}`
        );

        // Process batch
        await this.validationService.validatePolygonsBatch(batch, validationTypes);

        processed += batch.length;

        // Update progress with percentage (matching PHP v2 pattern)
        const progressPercentage = Math.floor((processed / polygonUuids.length) * 100);
        await DelayedJob.update(
          {
            processedContent: processed,
            progressMessage: `Running ${processed} out of ${polygonUuids.length} polygons (${progressPercentage}%)`
          },
          { where: { id: delayedJobId } }
        );
      }

      // Generate summary
      this.logger.log(`Generating validation summary for site ${siteUuid}`);
      const summary = await this.validationService.generateValidationSummary(siteUuid, validationTypes);

      // Mark job as complete
      await DelayedJob.update(
        {
          status: "succeeded",
          statusCode: 200,
          payload: summary,
          progressMessage: `Completed validation of ${polygonUuids.length} polygons`
        },
        { where: { id: delayedJobId } }
      );

      this.logger.log(`Successfully completed site validation for site ${siteUuid}`);
    } catch (error) {
      this.logger.error(`Error processing site validation for site ${siteUuid}:`, error);

      await DelayedJob.update(
        {
          status: "failed",
          statusCode: 500,
          payload: { error: error instanceof Error ? error.message : "Unknown error occurred" }
        },
        { where: { id: delayedJobId } }
      );
    }
  }
}

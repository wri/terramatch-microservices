import { Processor } from "@nestjs/bullmq";
import { TMLogger } from "@terramatch-microservices/common/util/tm-logger";
import {
  DelayedJobException,
  DelayedJobWorker
} from "@terramatch-microservices/common/workers/delayed-job-worker.processor";
import { IndicatorsService } from "./indicators.service";
import { Job } from "bullmq";
import { IndicatorsSummaryDto } from "./dto/Indicators-summary.dto";
import { buildJsonApi } from "@terramatch-microservices/common/util/json-api-builder";
import { populateDto } from "@terramatch-microservices/common/dto/json-api-attributes";
import { IndicatorSlug } from "@terramatch-microservices/database/constants";

export interface IndicatorsJobData {
  slug: IndicatorSlug;
  delayedJobId: number;
  polygonUuids: string[];
}

const KEEP_JOBS_TIMEOUT = 60 * 60;

@Processor("indicators", {
  concurrency: 10,
  removeOnComplete: { age: KEEP_JOBS_TIMEOUT },
  removeOnFail: { age: KEEP_JOBS_TIMEOUT }
})
export class IndicatorsProcessor extends DelayedJobWorker<IndicatorsJobData> {
  protected readonly logger = new TMLogger(IndicatorsProcessor.name);

  constructor(private readonly indicatorService: IndicatorsService) {
    super();
  }

  async processDelayedJob(job: Job<IndicatorsJobData>) {
    const { delayedJobId, polygonUuids, slug } = job.data;
    this.logger.debug(`polygonUuids ${polygonUuids.join(",")}`);

    if (polygonUuids.length === 0) {
      throw new DelayedJobException(404, `No polygons found for delayed job ${delayedJobId.toString()}`);
    }

    await this.updateJobProgress(job, {
      totalContent: polygonUuids.length,
      processedContent: 0,
      progressMessage: `Starting indicators analysis of ${polygonUuids.length} polygons...`
    });

    const batchSize = 50;
    let processed = 0;

    for (let i = 0; i < polygonUuids.length; i += batchSize) {
      const batch = polygonUuids.slice(i, i + batchSize);
      await this.indicatorService.process(slug, batch);
      processed += batch.length;
      await this.updateJobProgress(job, {
        processedContent: processed,
        progressMessage: `Analyzing ${processed} out of ${polygonUuids.length} polygons...`
      });
    }

    const document = buildJsonApi(IndicatorsSummaryDto).addData(
      polygonUuids.join(","),
      populateDto(new IndicatorsSummaryDto(), {
        polygonUuids: polygonUuids,
        totalPolygons: polygonUuids.length
      })
    );

    return {
      processedContent: 1,
      progressMessage: "Completed indicators analysis",
      payload: document
    };
  }
}

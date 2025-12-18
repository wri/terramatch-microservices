import { Processor } from "@nestjs/bullmq";
import { Job, Queue } from "bullmq";
import { InjectQueue } from "@nestjs/bullmq";
import { TMLogger } from "@terramatch-microservices/common/util/tm-logger";
import { PolygonClippingService } from "./polygon-clipping.service";
import {
  DelayedJobException,
  DelayedJobWorker
} from "@terramatch-microservices/common/workers/delayed-job-worker.processor";
import { ClippedVersionDto } from "./dto/clipped-version.dto";
import { buildJsonApi } from "@terramatch-microservices/common/util";
import { populateDto } from "@terramatch-microservices/common/dto/json-api-attributes";
import { PolygonClippingCompleteEmail } from "@terramatch-microservices/common/email/polygon-clipping-complete.email";

export interface ClippingJobData {
  polygonUuids: string[];
  userId: number;
  userFullName: string | null;
  source: string;
  delayedJobId: number;
  siteUuid?: string;
}

const KEEP_JOBS_TIMEOUT = 60 * 60;

@Processor("clipping", {
  concurrency: 10,
  removeOnComplete: { age: KEEP_JOBS_TIMEOUT },
  removeOnFail: { age: KEEP_JOBS_TIMEOUT }
})
export class ClippingProcessor extends DelayedJobWorker<ClippingJobData> {
  protected readonly logger = new TMLogger(ClippingProcessor.name);

  constructor(
    private readonly clippingService: PolygonClippingService,
    @InjectQueue("email") private readonly emailQueue: Queue
  ) {
    super();
  }

  async processDelayedJob(job: Job<ClippingJobData>) {
    const { polygonUuids, userId, userFullName, source, siteUuid } = job.data;

    if (polygonUuids.length === 0) {
      throw new DelayedJobException(400, "No polygon UUIDs provided");
    }

    await this.updateJobProgress(job, {
      totalContent: polygonUuids.length,
      processedContent: 0,
      progressMessage: `Starting clipping of ${polygonUuids.length} polygons...`
    });

    const createdVersions = await this.clippingService.clipAndCreateVersions(
      polygonUuids,
      userId,
      userFullName,
      source
    );

    if (createdVersions.length === 0) {
      throw new DelayedJobException(404, "No fixable overlapping polygons found or clipping failed");
    }

    await this.updateJobProgress(job, {
      processedContent: createdVersions.length,
      progressMessage: `Clipped ${createdVersions.length} polygons`
    });

    const document = buildJsonApi(ClippedVersionDto);

    for (const version of createdVersions) {
      document.addData(
        version.uuid,
        populateDto(new ClippedVersionDto(), {
          uuid: version.uuid,
          polyName: version.polyName,
          originalArea: version.originalArea,
          newArea: version.newArea,
          areaRemoved: version.areaRemoved
        })
      );
    }

    try {
      const completedAt = new Date();
      await new PolygonClippingCompleteEmail({
        userId,
        siteUuid,
        polygonUuids,
        completedAt
      }).sendLater(this.emailQueue);
      this.logger.log(`Queued polygon clipping complete email for user ${userId}`);
    } catch (error) {
      this.logger.error(`Failed to queue clipping complete email for user ${userId}`, error);
    }

    return {
      processedContent: createdVersions.length,
      progressMessage: `Completed clipping of ${createdVersions.length} polygons`,
      payload: document
    };
  }
}

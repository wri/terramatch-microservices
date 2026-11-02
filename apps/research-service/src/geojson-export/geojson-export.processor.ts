import { Processor } from "@nestjs/bullmq";
import { InternalServerErrorException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Job, Queue } from "bullmq";
import {
  DelayedJobException,
  DelayedJobWorker
} from "@terramatch-microservices/common/workers/delayed-job-worker.processor";
import { TMLogger } from "@terramatch-microservices/common/util/tm-logger";
import { FileService } from "@terramatch-microservices/common/file/file.service";
import { buildDelayedJobResponse, buildJsonApi } from "@terramatch-microservices/common/util";
import { FileDownloadDto } from "@terramatch-microservices/common/dto/file-download.dto";
import { timestampFileName } from "@terramatch-microservices/common/util/fileNames";
import { UserContext } from "@terramatch-microservices/common/contexts/user.context";
import { DelayedJob } from "@terramatch-microservices/database/entities";
import { GeoJsonExportService } from "./geojson-export.service";
import { GeoJsonExportAttributes } from "./dto/geojson-export-request.dto";

export const GEOJSON_EXPORT_QUEUE = "geojson-export";

export type GeoJsonExportJobData = {
  delayedJobId: number;
  scope: GeoJsonExportAttributes;
  fileName: string;
};

const KEEP_JOBS_TIMEOUT = 60 * 60; // keep jobs for 1 hour after completion (instead of default of forever)

// Exports are memory and IO bound, and run in the same task as the API, so keep concurrency low.
@Processor(GEOJSON_EXPORT_QUEUE, {
  concurrency: 3,
  removeOnComplete: { age: KEEP_JOBS_TIMEOUT },
  removeOnFail: { age: KEEP_JOBS_TIMEOUT }
})
export class GeoJsonExportProcessor extends DelayedJobWorker<GeoJsonExportJobData> {
  protected readonly logger = new TMLogger(GeoJsonExportProcessor.name);

  static async queueExport(queue: Queue, scope: GeoJsonExportAttributes, entityName: string, entityType?: string) {
    const delayedJob = await DelayedJob.create({
      name: "Polygon GeoJSON Export",
      createdBy: UserContext.authenticatedUserId,
      isAcknowledged: false,
      processedContent: 0,
      metadata: { entity_type: entityType, entity_name: entityName }
    });
    // The job uuid keeps the S3 key unique when two exports share a name and timestamp.
    const fileName = `exports/polygon-exports/${delayedJob.uuid}/${timestampFileName(
      `${entityName} polygons`,
      ".geojson"
    )}`;
    const data: GeoJsonExportJobData = { delayedJobId: delayedJob.id, scope, fileName };
    await queue.add("geojsonExport", data);
    return buildDelayedJobResponse(delayedJob);
  }

  constructor(
    private readonly geoJsonExportService: GeoJsonExportService,
    private readonly fileService: FileService,
    private readonly configService: ConfigService
  ) {
    super();
  }

  private get bucket() {
    const bucket = this.configService.get<string>("AWS_BUCKET");
    if (bucket == null) throw new InternalServerErrorException("AWS_BUCKET configuration is missing");

    return bucket;
  }

  async processDelayedJob(job: Job<GeoJsonExportJobData>) {
    const { scope, fileName } = job.data;

    try {
      await this.fileService.uploadStream(this.bucket, fileName, "application/geo+json", async stream => {
        await this.geoJsonExportService.writeFeatureCollection(stream, scope, async (processed, total) => {
          await this.updateJobProgress(job, { processedContent: processed, totalContent: total });
        });
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : `${error}`;
      throw new DelayedJobException(500, `Failed to export polygons: ${message}`);
    }

    return {
      payload: buildJsonApi(FileDownloadDto).addData(
        `geojsonExport|${job.data.delayedJobId}`,
        new FileDownloadDto(await this.fileService.generatePresignedUrl(this.bucket, fileName))
      )
    };
  }
}

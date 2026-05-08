import { Processor } from "@nestjs/bullmq";
import {
  DelayedJobException,
  DelayedJobWorker
} from "@terramatch-microservices/common/workers/delayed-job-worker.processor";
import { Job, Queue } from "bullmq";
import { DelayedJob } from "@terramatch-microservices/database/entities";
import { InternalServerErrorException } from "@nestjs/common";
import { timestampFileName } from "@terramatch-microservices/common/util/filenames";
import { TMLogger } from "@terramatch-microservices/common/util/tm-logger";
import { EntitiesService } from "../entities/entities.service";
import { DelayedJobDto } from "@terramatch-microservices/common/dto";
import { buildJsonApi } from "@terramatch-microservices/common/util";
import { authenticatedUserId } from "@terramatch-microservices/common/guards/auth.guard";
import { FileService } from "@terramatch-microservices/common/file/file.service";
import { ConfigService } from "@nestjs/config";
import { streamZip } from "@terramatch-microservices/common/util/zip-stream";
import { FileDownloadDto } from "@terramatch-microservices/common/dto/file-download.dto";

export type EntityServiceExportJobData = {
  delayedJobId: number;
  projectUuid: string;
  projectName: string;
};

export const ENTITY_SERVICE_EXPORT_QUEUE = "entityServiceExports";
export const PROJECT_EXPORT = "projectExport";

const KEEP_JOBS_TIMEOUT = 60 * 60; // keep jobs for 1 hour after completion (instead of default of forever)
@Processor(ENTITY_SERVICE_EXPORT_QUEUE, {
  concurrency: 100,
  removeOnComplete: { age: KEEP_JOBS_TIMEOUT },
  removeOnFail: { age: KEEP_JOBS_TIMEOUT }
})
export class EntityServiceExportsProcessor extends DelayedJobWorker<EntityServiceExportJobData> {
  protected readonly logger = new TMLogger(EntityServiceExportsProcessor.name);

  static async queueProjectExport(queue: Queue, projectUuid: string, projectName: string) {
    const delayedJob = await DelayedJob.create({
      name: "Project Zip Export",
      createdBy: authenticatedUserId()
    });
    const data: EntityServiceExportJobData = { delayedJobId: delayedJob.id, projectUuid, projectName };
    await queue.add(PROJECT_EXPORT, data);
    return buildJsonApi(DelayedJobDto).addData(delayedJob.uuid, new DelayedJobDto(delayedJob));
  }

  constructor(
    private readonly entitiesService: EntitiesService,
    private readonly fileService: FileService,
    private readonly configService: ConfigService
  ) {
    super();
  }

  async processDelayedJob(job: Job<EntityServiceExportJobData>) {
    if (job.name !== PROJECT_EXPORT) {
      throw new InternalServerErrorException(`Unsupported job name: ${job.name}`);
    }

    const bucket = this.configService.get("AWS_BUCKET");
    if (bucket == null) throw new InternalServerErrorException("AWS_BUCKET configuration is missing");

    const fileName = `exports/pd-exports/${timestampFileName(`${job.data.projectName} full export`, ".zip")}`;

    try {
      const stream = this.fileService.uploadStream(bucket, fileName, "application/zip");
      const processor = this.entitiesService.createEntityProcessor("projects");
      await streamZip(stream, async archive => {
        await processor.export(job.data.projectUuid, archive);
      });
    } catch (error) {
      throw new DelayedJobException(500, `Failed to export project zip: ${error.message}`);
    }

    return {
      payload: buildJsonApi(FileDownloadDto).addData(
        `projectExport|${job.data.projectUuid}`,
        new FileDownloadDto(await this.fileService.generatePresignedUrl(bucket, fileName))
      )
    };
  }
}

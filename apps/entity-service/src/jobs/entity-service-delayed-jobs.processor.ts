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
import { FileService } from "@terramatch-microservices/common/file/file.service";
import { ConfigService } from "@nestjs/config";
import { streamZip } from "@terramatch-microservices/common/util/zip-stream";
import { FileDownloadDto } from "@terramatch-microservices/common/dto/file-download.dto";
import { UserContext } from "@terramatch-microservices/common/contexts/user.context";
import { EntityType } from "@terramatch-microservices/database/constants/entities";

export type EntityExportJobData = {
  delayedJobId: number;
  projectUuid: string;
  projectName: string;
};

export type MediaExportJobData = {
  delayedJobId: number;
  entityType: EntityType;
  entityUuid: string;
};

export type EntityServiceDelayedJobData = EntityExportJobData | MediaExportJobData;

export const ENTITY_SERVICE_EXPORT_QUEUE = "entityServiceExports";
export const PROJECT_EXPORT = "projectExport";
export const MEDIA_EXPORT = "mediaExport";

const KEEP_JOBS_TIMEOUT = 60 * 60; // keep jobs for 1 hour after completion (instead of default of forever)
@Processor(ENTITY_SERVICE_EXPORT_QUEUE, {
  concurrency: 100,
  removeOnComplete: { age: KEEP_JOBS_TIMEOUT },
  removeOnFail: { age: KEEP_JOBS_TIMEOUT }
})
export class EntityServiceDelayedJobsProcessor extends DelayedJobWorker<EntityServiceDelayedJobData> {
  protected readonly logger = new TMLogger(EntityServiceDelayedJobsProcessor.name);

  static async queueProjectExport(queue: Queue, projectUuid: string, projectName: string) {
    const delayedJob = await DelayedJob.create({
      name: "Project Zip Export",
      createdBy: UserContext.authenticatedUserId
    });
    const data: EntityExportJobData = { delayedJobId: delayedJob.id, projectUuid, projectName };
    await queue.add(PROJECT_EXPORT, data);
    return buildJsonApi(DelayedJobDto).addData(delayedJob.uuid, new DelayedJobDto(delayedJob));
  }

  static async queueMediaExport(queue: Queue, entityType: EntityType, entityUuid: string) {
    const delayedJob = await DelayedJob.create({
      name: "Entity Media Export",
      createdBy: UserContext.authenticatedUserId
    });
    const data: MediaExportJobData = { delayedJobId: delayedJob.id, entityType, entityUuid };
    await queue.add(MEDIA_EXPORT, data);
    return buildJsonApi(DelayedJobDto).addData(delayedJob.uuid, new DelayedJobDto(delayedJob));
  }

  constructor(
    private readonly entitiesService: EntitiesService,
    private readonly fileService: FileService,
    private readonly configService: ConfigService
  ) {
    super();
  }

  async processDelayedJob(job: Job<EntityServiceDelayedJobData>) {
    if (job.name === PROJECT_EXPORT) {
      return await this.processEntityExport(job as Job<EntityExportJobData>);
    } else {
      throw new InternalServerErrorException(`Unsupported job name: ${job.name}`);
    }
  }

  private async processEntityExport(job: Job<EntityExportJobData>) {
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
      const message = error instanceof Error ? error.message : `${error}`;
      throw new DelayedJobException(500, `Failed to export project zip: ${message}`);
    }

    return {
      payload: buildJsonApi(FileDownloadDto).addData(
        `projectExport|${job.data.projectUuid}`,
        new FileDownloadDto(await this.fileService.generatePresignedUrl(bucket, fileName))
      )
    };
  }
}

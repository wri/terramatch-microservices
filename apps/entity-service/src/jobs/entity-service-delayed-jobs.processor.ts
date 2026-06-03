import { Processor } from "@nestjs/bullmq";
import {
  DelayedJobException,
  DelayedJobWorker
} from "@terramatch-microservices/common/workers/delayed-job-worker.processor";
import { Job, Queue } from "bullmq";
import {
  DelayedJob,
  Media,
  Nursery,
  NurseryReport,
  Project,
  ProjectReport,
  Site,
  SiteReport
} from "@terramatch-microservices/database/entities";
import { InternalServerErrorException } from "@nestjs/common";
import { timestampFileName } from "@terramatch-microservices/common/util/fileNames";
import { TMLogger } from "@terramatch-microservices/common/util/tm-logger";
import { EntitiesService } from "../entities/entities.service";
import { DelayedJobDto } from "@terramatch-microservices/common/dto";
import { buildJsonApi } from "@terramatch-microservices/common/util";
import { FileService } from "@terramatch-microservices/common/file/file.service";
import { ConfigService } from "@nestjs/config";
import { streamZip } from "@terramatch-microservices/common/util/zip-stream";
import { FileDownloadDto } from "@terramatch-microservices/common/dto/file-download.dto";
import { UserContext } from "@terramatch-microservices/common/contexts/user.context";
import { EntityType, ReportModel } from "@terramatch-microservices/database/constants/entities";
import { Attributes, ModelStatic, Op, WhereOptions } from "sequelize";
import { Literal } from "sequelize/lib/utils";
import { Dictionary } from "lodash";
import { Subquery } from "@terramatch-microservices/database/util/subquery.builder";

export type EntityExportJobData = {
  delayedJobId: number;
  projectUuid: string;
  projectName: string;
};

export type MediaExportJobData = {
  delayedJobId: number;
  entityType: EntityType;
  entityUuid: string;
  entityName: string;
  totalContent: number | null;
};

export type EntityServiceDelayedJobData = EntityExportJobData | MediaExportJobData;

export const ENTITY_SERVICE_EXPORT_QUEUE = "entityServiceExports";
export const PROJECT_EXPORT = "projectExport";
export const MEDIA_EXPORT = "mediaExport";

type ReportDependency<T extends ReportModel> = {
  model: ModelStatic<T>;
  reportType: string;
  parentType: string;
  parentAttribute: keyof Attributes<T>;
};

const PROJECT_REPORT_DEP: ReportDependency<ProjectReport> = {
  model: ProjectReport,
  reportType: ProjectReport.LARAVEL_TYPE,
  parentType: Project.LARAVEL_TYPE,
  parentAttribute: "projectId"
};
const SITE_REPORT_DEP: ReportDependency<SiteReport> = {
  model: SiteReport,
  reportType: SiteReport.LARAVEL_TYPE,
  parentType: Site.LARAVEL_TYPE,
  parentAttribute: "siteId"
};
const NURSERY_REPORT_DEP: ReportDependency<NurseryReport> = {
  model: NurseryReport,
  reportType: NurseryReport.LARAVEL_TYPE,
  parentType: Nursery.LARAVEL_TYPE,
  parentAttribute: "nurseryId"
};

const REPORT_DEPENDENCIES = [PROJECT_REPORT_DEP, SITE_REPORT_DEP, NURSERY_REPORT_DEP];

const totalForMediaExport = async (entityType: EntityType, uuid: string) => {
  // Mapping of modelType to modelId literal for Media queries
  const entityScopes: Dictionary<Literal> = {};

  if (entityType === "projects") {
    const projectIdSubquery = Subquery.select(Project, "id").eq("uuid", uuid).literal;
    entityScopes[Project.LARAVEL_TYPE] = projectIdSubquery;
    entityScopes[Site.LARAVEL_TYPE] = Subquery.select(Site, "id").eq("projectId", projectIdSubquery).literal;
    entityScopes[Nursery.LARAVEL_TYPE] = Subquery.select(Nursery, "id").eq("projectId", projectIdSubquery).literal;
  } else if (entityType === "sites") {
    entityScopes[Site.LARAVEL_TYPE] = Subquery.select(Site, "id").eq("uuid", uuid).literal;
  } else if (entityType === "nurseries") {
    entityScopes[Nursery.LARAVEL_TYPE] = Subquery.select(Nursery, "id").eq("uuid", uuid).literal;
  }

  for (const dep of REPORT_DEPENDENCIES) {
    const { model, parentType, reportType, parentAttribute } = dep as ReportDependency<ReportModel>;
    if (entityScopes[parentType] != null) {
      entityScopes[reportType] = Subquery.select(model, "id").in(parentAttribute, entityScopes[parentType]).literal;
    }
  }

  return await Media.count({
    where: {
      [Op.or]: Object.entries(entityScopes).reduce(
        (acc, [modelType, modelIds]) => [...acc, { modelType, modelId: { [Op.in]: modelIds } }],
        [] as WhereOptions[]
      )
    }
  });
};

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

  static async queueMediaExport(
    queue: Queue,
    entityType: EntityType,
    entityUuid: string,
    entityName: string,
    jobName: string
  ) {
    const totalContent = await totalForMediaExport(entityType, entityUuid);
    const delayedJob = await DelayedJob.create({
      name: jobName,
      createdBy: UserContext.authenticatedUserId,
      totalContent,
      isAcknowledged: totalContent == null
    });
    const data: MediaExportJobData = { delayedJobId: delayedJob.id, entityType, entityUuid, entityName, totalContent };
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

  private get bucket() {
    const bucket = this.configService.get("AWS_BUCKET");
    if (bucket == null) throw new InternalServerErrorException("AWS_BUCKET configuration is missing");

    return bucket;
  }

  async processDelayedJob(job: Job<EntityServiceDelayedJobData>) {
    if (job.name === PROJECT_EXPORT) {
      return await this.processEntityExport(job.data as EntityExportJobData);
    } else if (job.name === MEDIA_EXPORT) {
      return await this.processMediaExport(job as Job<MediaExportJobData>);
    } else {
      throw new InternalServerErrorException(`Unsupported job name: ${job.name}`);
    }
  }

  private async processEntityExport({ projectName, projectUuid }: EntityExportJobData) {
    const fileName = `exports/pd-exports/${timestampFileName(
      `${projectName} ${await this.entitiesService.localizeText("full export")}`,
      ".zip"
    )}`;

    try {
      await this.fileService.uploadStream(this.bucket, fileName, "application/zip", async stream => {
        const processor = this.entitiesService.createEntityProcessor("projects");
        await streamZip(stream, async archive => {
          await processor.export(projectUuid, archive);
        });
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : `${error}`;
      throw new DelayedJobException(500, `Failed to export project zip: ${message}`);
    }

    return {
      payload: buildJsonApi(FileDownloadDto).addData(
        `projectExport|${projectUuid}`,
        new FileDownloadDto(await this.fileService.generatePresignedUrl(this.bucket, fileName))
      )
    };
  }

  private async processMediaExport(job: Job<MediaExportJobData>) {
    const {
      data: { entityType, entityUuid, entityName, totalContent }
    } = job;

    let totalProcessed = 0;
    const progressTick = async (progressCount = 1) => {
      if (totalContent == null) return;

      // only update the total every 10 ticks;
      const shouldUpdate = Math.floor(totalProcessed / 10) !== Math.floor((totalProcessed + progressCount) / 10);
      totalProcessed += progressCount;
      if (shouldUpdate) {
        await this.updateJobProgress(job, { processedContent: totalProcessed });
      }
    };

    const fileName = `exports/media-exports/${timestampFileName(
      `${entityName} - ${await this.entitiesService.localizeText("assets")}`,
      ".zip"
    )}`;

    try {
      await this.fileService.uploadStream(this.bucket, fileName, "application/zip", async stream => {
        const processor = this.entitiesService.createEntityProcessor(entityType);
        await streamZip(stream, async archive => {
          await processor.exportMedia([entityUuid], archive, progressTick);
        });
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : `${error}`;
      throw new DelayedJobException(500, `Failed to export entity media: ${message}`);
    }

    // make sure we register as 100%
    if (totalContent != null) {
      await this.updateJobProgress(job, { processedContent: totalContent });
    }

    return {
      payload: buildJsonApi(FileDownloadDto).addData(
        `mediaExport|${entityType}|${entityUuid}`,
        new FileDownloadDto(await this.fileService.generatePresignedUrl(this.bucket, fileName))
      )
    };
  }
}

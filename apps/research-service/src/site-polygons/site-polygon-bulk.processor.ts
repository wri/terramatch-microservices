import { Processor } from "@nestjs/bullmq";
import { InternalServerErrorException } from "@nestjs/common";
import { Job, Queue } from "bullmq";
import { uniq } from "lodash";
import {
  DelayedJobResult,
  DelayedJobWorker
} from "@terramatch-microservices/common/workers/delayed-job-worker.processor";
import { TMLogger } from "@terramatch-microservices/common/util/tm-logger";
import { buildDelayedJobResponse, buildDeletedResponse, getDtoType } from "@terramatch-microservices/common/util";
import { UserContext } from "@terramatch-microservices/common/contexts/user.context";
import { DelayedJob, Site, SitePolygon } from "@terramatch-microservices/database/entities";
import { PolygonStatus } from "@terramatch-microservices/database/constants";
import { isNotNull } from "@terramatch-microservices/database/types/array";
import { getPrimaryUuids, SitePolygonsService } from "./site-polygons.service";
import { SitePolygonBulkUpdateService } from "./site-polygon-bulk-update.service";
import { SitePolygonFullDto } from "./dto/site-polygon.dto";
import { SitePolygonStatusUpdate } from "./dto/site-polygon-status-update.dto";
import { SitePolygonBulkAttributeChangesDto } from "./dto/site-polygon-bulk-attribute-update.dto";

export const SITE_POLYGON_BULK_QUEUE = "sitePolygonBulk";
export const BULK_DELETE = "bulkDelete";
export const BULK_STATUS_UPDATE = "bulkStatusUpdate";
export const BULK_ATTRIBUTE_UPDATE = "bulkAttributeUpdate";

// Must match the FE background toast threshold (TM-4098).
export const BULK_ASYNC_THRESHOLD = 50;

export type BulkDeleteJobData = {
  delayedJobId: number;
  primaryUuids: string[];
};

export type BulkStatusUpdateJobData = {
  delayedJobId: number;
  userId: number;
  status: PolygonStatus;
  data: SitePolygonStatusUpdate[];
  comment?: string;
};

export type BulkAttributeUpdateJobData = {
  delayedJobId: number;
  userId: number;
  sitePolygonUuids: string[];
  attributeChanges: SitePolygonBulkAttributeChangesDto;
};

type SitePolygonBulkJobData = BulkDeleteJobData | BulkStatusUpdateJobData | BulkAttributeUpdateJobData;

const KEEP_JOBS_TIMEOUT = 60 * 60;

const getJobMetadata = async (sitePolygons: SitePolygon[], polygonCount: number) => {
  const siteUuids = uniq(sitePolygons.map(({ siteUuid }) => siteUuid).filter(isNotNull));
  const site =
    siteUuids.length === 1 ? await Site.findOne({ where: { uuid: siteUuids[0] }, attributes: ["name"] }) : null;
  const siteName = site?.name;
  return siteName == null
    ? { entity_name: `${polygonCount} polygons` }
    : { entity_type: Site.LARAVEL_TYPE, entity_name: siteName };
};

@Processor(SITE_POLYGON_BULK_QUEUE, {
  removeOnComplete: { age: KEEP_JOBS_TIMEOUT },
  removeOnFail: { age: KEEP_JOBS_TIMEOUT }
})
export class SitePolygonBulkProcessor extends DelayedJobWorker<SitePolygonBulkJobData> {
  protected readonly logger = new TMLogger(SitePolygonBulkProcessor.name);

  static async queueBulkDelete(queue: Queue, sitePolygons: SitePolygon[]) {
    const primaryUuids = getPrimaryUuids(sitePolygons);
    return await this.queueJob<BulkDeleteJobData>(
      queue,
      BULK_DELETE,
      "Polygon Bulk Delete",
      sitePolygons,
      primaryUuids.length,
      { primaryUuids }
    );
  }

  static async queueBulkStatusUpdate(
    queue: Queue,
    sitePolygons: SitePolygon[],
    data: Omit<BulkStatusUpdateJobData, "delayedJobId">
  ) {
    return await this.queueJob<BulkStatusUpdateJobData>(
      queue,
      BULK_STATUS_UPDATE,
      "Polygon Bulk Status Update",
      sitePolygons,
      data.data.length,
      data
    );
  }

  static async queueBulkAttributeUpdate(
    queue: Queue,
    sitePolygons: SitePolygon[],
    data: Omit<BulkAttributeUpdateJobData, "delayedJobId">
  ) {
    return await this.queueJob<BulkAttributeUpdateJobData>(
      queue,
      BULK_ATTRIBUTE_UPDATE,
      "Polygon Bulk Attribute Update",
      sitePolygons,
      data.sitePolygonUuids.length,
      data
    );
  }

  private static async queueJob<T extends SitePolygonBulkJobData>(
    queue: Queue,
    jobName: string,
    delayedJobName: string,
    sitePolygons: SitePolygon[],
    totalContent: number,
    data: Omit<T, "delayedJobId">
  ) {
    const delayedJob = await DelayedJob.create({
      name: delayedJobName,
      createdBy: UserContext.authenticatedUserId,
      isAcknowledged: false,
      totalContent,
      processedContent: 0,
      metadata: await getJobMetadata(sitePolygons, totalContent)
    });
    await queue.add(jobName, { ...data, delayedJobId: delayedJob.id });
    return buildDelayedJobResponse(delayedJob);
  }

  constructor(
    private readonly sitePolygonsService: SitePolygonsService,
    private readonly sitePolygonBulkUpdateService: SitePolygonBulkUpdateService
  ) {
    super();
  }

  async processDelayedJob(job: Job<SitePolygonBulkJobData>): Promise<DelayedJobResult> {
    if (job.name === BULK_DELETE) {
      return await this.deletePolygons(job as Job<BulkDeleteJobData>);
    } else if (job.name === BULK_STATUS_UPDATE) {
      return await this.updateStatus(job.data as BulkStatusUpdateJobData);
    } else if (job.name === BULK_ATTRIBUTE_UPDATE) {
      return await this.updateAttributes(job.data as BulkAttributeUpdateJobData);
    } else {
      throw new InternalServerErrorException(`Unsupported job name: ${job.name}`);
    }
  }

  private async deletePolygons(job: Job<BulkDeleteJobData>): Promise<DelayedJobResult> {
    const { primaryUuids } = job.data;
    const deletedUuids = await this.sitePolygonsService.bulkDeleteSitePolygonsInBatches(primaryUuids, processed =>
      this.updateJobProgress(job, { processedContent: processed })
    );
    return {
      processedContent: primaryUuids.length,
      payload: buildDeletedResponse(getDtoType(SitePolygonFullDto), deletedUuids)
    };
  }

  private async updateStatus({ userId, status, data, comment }: BulkStatusUpdateJobData): Promise<DelayedJobResult> {
    const sitePolygons = await this.sitePolygonBulkUpdateService.updateStatus(status, data, comment, userId);
    return {
      processedContent: sitePolygons.length,
      payload: await this.sitePolygonsService.buildLightDocument(sitePolygons)
    };
  }

  private async updateAttributes({
    userId,
    sitePolygonUuids,
    attributeChanges
  }: BulkAttributeUpdateJobData): Promise<DelayedJobResult> {
    const newVersions = await this.sitePolygonBulkUpdateService.updateAttributes(
      sitePolygonUuids,
      attributeChanges,
      userId
    );
    return {
      processedContent: newVersions.length,
      payload: await this.sitePolygonsService.buildLightDocument(newVersions)
    };
  }
}

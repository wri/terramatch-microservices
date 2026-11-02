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
import { isNotNull } from "@terramatch-microservices/database/types/array";
import { getPrimaryUuids, SitePolygonsService } from "./site-polygons.service";
import { SitePolygonFullDto } from "./dto/site-polygon.dto";

export const SITE_POLYGON_BULK_QUEUE = "sitePolygonBulk";
export const BULK_DELETE = "bulkDelete";

// Must match the FE background toast threshold (TM-4098).
export const BULK_ASYNC_THRESHOLD = 50;

export type BulkDeleteJobData = {
  delayedJobId: number;
  primaryUuids: string[];
};

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
export class SitePolygonBulkProcessor extends DelayedJobWorker<BulkDeleteJobData> {
  protected readonly logger = new TMLogger(SitePolygonBulkProcessor.name);

  static async queueBulkDelete(queue: Queue, sitePolygons: SitePolygon[]) {
    const primaryUuids = getPrimaryUuids(sitePolygons);
    const delayedJob = await DelayedJob.create({
      name: "Polygon Bulk Delete",
      createdBy: UserContext.authenticatedUserId,
      isAcknowledged: false,
      totalContent: primaryUuids.length,
      processedContent: 0,
      metadata: await getJobMetadata(sitePolygons, primaryUuids.length)
    });
    const data: BulkDeleteJobData = { delayedJobId: delayedJob.id, primaryUuids };
    await queue.add(BULK_DELETE, data);
    return buildDelayedJobResponse(delayedJob);
  }

  constructor(private readonly sitePolygonsService: SitePolygonsService) {
    super();
  }

  async processDelayedJob(job: Job<BulkDeleteJobData>): Promise<DelayedJobResult> {
    if (job.name !== BULK_DELETE) throw new InternalServerErrorException(`Unsupported job name: ${job.name}`);

    const deletedUuids = await this.sitePolygonsService.bulkDeleteSitePolygonsInBatches(
      job.data.primaryUuids,
      processed => this.updateJobProgress(job, { processedContent: processed })
    );

    return { payload: buildDeletedResponse(getDtoType(SitePolygonFullDto), deletedUuids) };
  }
}

import { Processor } from "@nestjs/bullmq";
import { TMLogger } from "@terramatch-microservices/common/util/tm-logger";
import {
  DelayedJobException,
  DelayedJobResult,
  DelayedJobWorker
} from "@terramatch-microservices/common/workers/delayed-job-worker.processor";
import { IndicatorsService } from "./indicators.service";
import { Job } from "bullmq";
import { IndicatorSlug } from "@terramatch-microservices/database/constants";
import {
  IndicatorExecutionOutcome,
  IndicatorExecutionTriggerSource,
  IndicatorAuditService
} from "./indicator-audit.service";
import {
  DelayedJob,
  IndicatorOutputHectares,
  IndicatorOutputTreeCoverLoss,
  SitePolygon
} from "@terramatch-microservices/database/entities";
import { CreationAttributes, Op } from "sequelize";
import { ModelCtor } from "sequelize-typescript";

const SLUG_MAPPINGS = {
  treeCoverLoss: IndicatorOutputTreeCoverLoss,
  treeCoverLossFires: IndicatorOutputTreeCoverLoss,
  restorationByEcoRegion: IndicatorOutputHectares,
  restorationByStrategy: IndicatorOutputHectares,
  restorationByLandUse: IndicatorOutputHectares
} as const;

export interface IndicatorsJobData {
  slug: IndicatorSlug;
  delayedJobId: number;
  polygonUuids: string[];
  forceRecalculation?: boolean;
  updateExisting?: boolean;
  triggerSource?: IndicatorExecutionTriggerSource;
}

type IndicatorJobSummary = {
  slug: string;
  totalPolygons: number;
  dataFound: number;
  noData: number;
  failed: number;
  failedPolygonUuids: string[];
  noDataPolygonUuids: string[];
  failureMessage: string | null;
};

const KEEP_JOBS_TIMEOUT = 60 * 60;

type IndicatorResultRow =
  | CreationAttributes<IndicatorOutputHectares>
  | CreationAttributes<IndicatorOutputTreeCoverLoss>;

type PolygonOutcome = "skipped" | "dataFound" | "noData" | "failed";

@Processor("sitePolygons", {
  concurrency: 10,
  removeOnComplete: { age: KEEP_JOBS_TIMEOUT },
  removeOnFail: { age: KEEP_JOBS_TIMEOUT }
})
export class IndicatorsProcessor extends DelayedJobWorker<IndicatorsJobData> {
  protected readonly logger = new TMLogger(IndicatorsProcessor.name);

  constructor(
    private readonly indicatorService: IndicatorsService,
    private readonly indicatorAuditService: IndicatorAuditService
  ) {
    super();
  }

  async processDelayedJob(job: Job<IndicatorsJobData>) {
    const {
      delayedJobId,
      polygonUuids,
      slug,
      forceRecalculation = false,
      updateExisting = false,
      triggerSource
    } = job.data;
    this.logger.debug(
      `polygonUuids ${polygonUuids.join(
        ","
      )}, forceRecalculation: ${forceRecalculation}, updateExisting: ${updateExisting}`
    );

    if (polygonUuids.length === 0) {
      throw new DelayedJobException(404, `No polygons found for delayed job ${delayedJobId.toString()}`);
    }

    const summary = this.createSummary(slug);
    const delayedJob = await DelayedJob.findByPk(delayedJobId, { attributes: ["id", "createdBy"] });
    const jobTriggerSource =
      triggerSource ??
      (delayedJob?.createdBy == null ? "system" : ("automated-job" as IndicatorExecutionTriggerSource));
    const jobContext = this.indicatorAuditService.createContext(
      jobTriggerSource,
      delayedJob?.createdBy ?? null,
      delayedJobId
    );

    await this.updateIndicatorsJobProgress(job, summary, 0, polygonUuids.length, {
      progressMessage: `Starting indicators analysis of ${polygonUuids.length} polygons...`
    });

    // Use batches when forceRecalculation is true (always process, no existence checks)
    // Otherwise, process one by one with existence checks based on updateExisting
    if (forceRecalculation) {
      return await this.processBatched(job, slug, polygonUuids, summary, jobContext);
    }

    return await this.processOneByOne(job, slug, polygonUuids, updateExisting, summary, jobContext);
  }

  /**
   * Process polygons in batches (used when forceRecalculation is true)
   * Similar to PHP's processBatchedAnalysis
   */
  private async processBatched(
    job: Job<IndicatorsJobData>,
    slug: IndicatorSlug,
    polygonUuids: string[],
    summary: IndicatorJobSummary,
    jobContext: ReturnType<IndicatorAuditService["createContext"]>
  ): Promise<DelayedJobResult> {
    const BATCH_SIZE = 50;
    const batches: string[][] = [];

    for (let i = 0; i < polygonUuids.length; i += BATCH_SIZE) {
      batches.push(polygonUuids.slice(i, i + BATCH_SIZE));
    }

    this.logger.debug(`Processing ${batches.length} batches for slug: ${slug}, batch size: ${BATCH_SIZE}`);

    let processed = 0;
    const results: IndicatorResultRow[] = [];

    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      this.logger.debug(`Processing batch ${batchIndex + 1} of ${batches.length}: ${batch.length} polygons`);

      for (const polygonUuid of batch) {
        const { result } = await this.processSinglePolygonForSave(slug, polygonUuid, summary, jobContext);

        if (result != null) {
          results.push(result);
        }
        processed++;
        await this.updateIndicatorsJobProgress(job, summary, processed, polygonUuids.length, {
          progressMessage: `Analyzing ${processed} out of ${polygonUuids.length} polygons... (batch ${batchIndex + 1}/${
            batches.length
          })`
        });
      }

      if (results.length > 0) {
        await this.indicatorService.saveResults(results, slug);
        results.length = 0;
      }
    }

    return this.finalizeJobOutcome(job, processed, summary);
  }

  private async processOneByOne(
    job: Job<IndicatorsJobData>,
    slug: IndicatorSlug,
    polygonUuids: string[],
    updateExisting: boolean,
    summary: IndicatorJobSummary,
    jobContext: ReturnType<IndicatorAuditService["createContext"]>
  ): Promise<DelayedJobResult> {
    let processed = 0;
    const results: IndicatorResultRow[] = [];

    for (const polygonUuid of polygonUuids) {
      const { result } = await this.processSinglePolygonForSave(slug, polygonUuid, summary, jobContext, updateExisting);

      if (result != null) {
        results.push(result);
      }
      processed++;
      await this.updateIndicatorsJobProgress(job, summary, processed, polygonUuids.length);
    }

    if (results.length > 0) {
      await this.indicatorService.saveResults(results, slug);
    }

    return this.finalizeJobOutcome(job, processed, summary);
  }

  /** Classifies polygon for progress summary only; save rules match the original processor. */
  private async processSinglePolygonForSave(
    slug: IndicatorSlug,
    polygonUuid: string,
    summary: IndicatorJobSummary,
    jobContext: ReturnType<IndicatorAuditService["createContext"]>,
    updateExisting = true
  ): Promise<{ outcome: PolygonOutcome; result?: IndicatorResultRow }> {
    const polygonContext = this.indicatorAuditService.createContext(
      jobContext.triggerSource,
      jobContext.triggeredBy,
      jobContext.delayedJobId
    );

    if (!updateExisting) {
      const exists = await this.checkIfExists(slug, polygonUuid);
      if (exists) {
        this.logger.debug(`Skipping polygon ${polygonUuid} - record already exists and updateExisting=false`);
        summary.totalPolygons++;
        await this.recordPolygonExecution(slug, polygonUuid, polygonContext, "skipped");
        return { outcome: "skipped" };
      }
    }

    try {
      const result = await this.indicatorService.processPolygon(slug, polygonUuid, polygonContext);
      if (result == null) {
        summary.noData++;
        summary.noDataPolygonUuids.push(polygonUuid);
        summary.totalPolygons++;
        await this.recordPolygonExecution(slug, polygonUuid, polygonContext, "no-data");
        return { outcome: "noData" };
      }

      if (this.isEmptyIndicatorValue(result.value)) {
        summary.noData++;
        summary.noDataPolygonUuids.push(polygonUuid);
        summary.totalPolygons++;
        await this.recordPolygonExecution(slug, polygonUuid, polygonContext, "no-data", result);
        return { outcome: "noData", result };
      }

      summary.dataFound++;
      summary.totalPolygons++;
      await this.recordPolygonExecution(slug, polygonUuid, polygonContext, "success", result);
      return { outcome: "dataFound", result };
    } catch (error) {
      summary.failed++;
      summary.failedPolygonUuids.push(polygonUuid);
      if (summary.failureMessage == null) {
        summary.failureMessage = error instanceof Error ? error.message : String(error);
      }
      this.logger.error(
        `Error processing polygon ${polygonUuid} for slug ${slug}: ${error instanceof Error ? error.message : String(error)}`,
        error
      );
      await this.recordPolygonExecution(
        slug,
        polygonUuid,
        polygonContext,
        "failed",
        null,
        error instanceof Error ? error.message : String(error)
      );
      return { outcome: "failed" };
    }
  }

  private async recordPolygonExecution(
    slug: IndicatorSlug,
    polygonUuid: string,
    context: ReturnType<IndicatorAuditService["createContext"]>,
    outcome: IndicatorExecutionOutcome,
    result?: IndicatorResultRow | null,
    errorMessage?: string | null
  ) {
    const sitePolygonId = result?.sitePolygonId ?? (await this.resolveSitePolygonId(polygonUuid));
    if (sitePolygonId == null) return;

    await this.indicatorAuditService.recordFromContext(context, {
      indicatorSlug: slug,
      sitePolygonId,
      polygonUuid,
      outcome,
      yearOfAnalysis: result?.yearOfAnalysis ?? null,
      errorMessage: errorMessage ?? null,
      resultValue: result?.value != null ? (result.value as object) : null
    });
  }

  private async resolveSitePolygonId(polygonUuid: string): Promise<number | null> {
    const sitePolygon = await SitePolygon.findOne({
      where: { polygonUuid: { [Op.eq]: polygonUuid }, isActive: true, status: "approved" },
      attributes: ["id"]
    });
    return sitePolygon?.id ?? null;
  }

  private async finalizeJobOutcome(
    job: Job<IndicatorsJobData>,
    processed: number,
    summary: IndicatorJobSummary
  ): Promise<DelayedJobResult> {
    const progressMessage = `Completed indicators analysis (${summary.dataFound} data found, ${summary.noData} no data, ${summary.failed} failed)`;

    await this.updateIndicatorsJobProgress(job, summary, processed, summary.totalPolygons, {
      progressMessage
    });

    return {
      processedContent: processed,
      progressMessage,
      payload: { data: summary }
    } as unknown as DelayedJobResult;
  }

  private createSummary(slug: IndicatorSlug): IndicatorJobSummary {
    return {
      slug,
      totalPolygons: 0,
      dataFound: 0,
      noData: 0,
      failed: 0,
      failedPolygonUuids: [],
      noDataPolygonUuids: [],
      failureMessage: null
    };
  }

  private isEmptyIndicatorValue(value: unknown): boolean {
    if (value == null) {
      return true;
    }
    if (typeof value === "object" && !Array.isArray(value)) {
      return Object.keys(value as Record<string, unknown>).length === 0;
    }
    return false;
  }

  private async updateIndicatorsJobProgress(
    job: Job<IndicatorsJobData>,
    summary: IndicatorJobSummary,
    processed: number,
    total: number,
    options?: { progressMessage?: string }
  ) {
    await DelayedJob.update(
      {
        totalContent: total,
        processedContent: processed,
        progressMessage: options?.progressMessage ?? `Analyzing ${processed} out of ${total} polygons...`,
        payload: { data: summary }
      },
      { where: { id: job.data.delayedJobId } }
    );
  }

  private async checkIfExists(slug: IndicatorSlug, polygonUuid: string): Promise<boolean> {
    const Model: ModelCtor | undefined = SLUG_MAPPINGS[slug as keyof typeof SLUG_MAPPINGS];
    if (Model == null) {
      return false;
    }

    const currentYear = new Date().getFullYear();

    const sitePolygon = await SitePolygon.findOne({
      where: { polygonUuid, isActive: true, status: "approved" },
      attributes: ["id"]
    });

    if (sitePolygon == null) {
      return false;
    }

    const count = await Model.count({
      where: {
        sitePolygonId: sitePolygon.id,
        indicatorSlug: slug,
        yearOfAnalysis: currentYear
      }
    });

    return count > 0;
  }
}

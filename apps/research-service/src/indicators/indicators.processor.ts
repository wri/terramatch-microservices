import { Processor } from "@nestjs/bullmq";
import { TMLogger } from "@terramatch-microservices/common/util/tm-logger";
import {
  DelayedJobException,
  DelayedJobWorker
} from "@terramatch-microservices/common/workers/delayed-job-worker.processor";
import { IndicatorsService } from "./indicators.service";
import { Job } from "bullmq";
import { buildJsonApi } from "@terramatch-microservices/common/util/json-api-builder";
import { IndicatorSlug } from "@terramatch-microservices/database/constants";
import {
  SitePolygon,
  IndicatorOutputHectares,
  IndicatorOutputTreeCoverLoss
} from "@terramatch-microservices/database/entities";
import { Op } from "sequelize";
import { SitePolygonLightDto } from "../site-polygons/dto/site-polygon.dto";
import { SitePolygonsService } from "../site-polygons/site-polygons.service";

const SLUG_MAPPINGS = {
  treeCoverLoss: IndicatorOutputTreeCoverLoss,
  treeCoverLossFires: IndicatorOutputTreeCoverLoss,
  restorationByEcoRegion: IndicatorOutputHectares,
  restorationByStrategy: IndicatorOutputHectares,
  restorationByLandUse: IndicatorOutputHectares
};

export interface IndicatorsJobData {
  slug: IndicatorSlug;
  delayedJobId: number;
  polygonUuids: string[];
  forceRecalculation?: boolean;
  updateExisting?: boolean;
}

const KEEP_JOBS_TIMEOUT = 60 * 60;

@Processor("sitePolygons", {
  concurrency: 10,
  removeOnComplete: { age: KEEP_JOBS_TIMEOUT },
  removeOnFail: { age: KEEP_JOBS_TIMEOUT }
})
export class IndicatorsProcessor extends DelayedJobWorker<IndicatorsJobData> {
  protected readonly logger = new TMLogger(IndicatorsProcessor.name);

  constructor(
    private readonly indicatorService: IndicatorsService,
    private readonly sitePolygonsService: SitePolygonsService
  ) {
    super();
  }

  async processDelayedJob(job: Job<IndicatorsJobData>) {
    const { delayedJobId, polygonUuids, slug, forceRecalculation = false, updateExisting = false } = job.data;
    this.logger.debug(
      `polygonUuids ${polygonUuids.join(
        ","
      )}, forceRecalculation: ${forceRecalculation}, updateExisting: ${updateExisting}`
    );

    if (polygonUuids.length === 0) {
      throw new DelayedJobException(404, `No polygons found for delayed job ${delayedJobId.toString()}`);
    }

    await this.updateJobProgress(job, {
      totalContent: polygonUuids.length,
      processedContent: 0,
      progressMessage: `Starting indicators analysis of ${polygonUuids.length} polygons...`
    });

    // Use batches only if forceRecalculation is true (like PHP version)
    // Otherwise, always process polygon by polygon (regardless of updateExisting)
    if (forceRecalculation) {
      return await this.processBatched(job, slug, polygonUuids);
    } else {
      // Process polygon by polygon (updateExisting can be true or false)
      return await this.processOneByOne(job, slug, polygonUuids, updateExisting, forceRecalculation);
    }
  }

  /**
   * Process polygons in batches (used when forceRecalculation is true)
   * Similar to PHP's processBatchedAnalysis
   */
  private async processBatched(job: Job<IndicatorsJobData>, slug: IndicatorSlug, polygonUuids: string[]) {
    const BATCH_SIZE = 50;
    const batches: string[][] = [];

    // Split into batches
    for (let i = 0; i < polygonUuids.length; i += BATCH_SIZE) {
      batches.push(polygonUuids.slice(i, i + BATCH_SIZE));
    }

    this.logger.debug(`Processing ${batches.length} batches for slug: ${slug}, batch size: ${BATCH_SIZE}`);

    let processed = 0;
    const successfulPolygons: string[] = [];
    const allResults: Array<Partial<IndicatorOutputHectares> | Partial<IndicatorOutputTreeCoverLoss>> = [];

    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      this.logger.debug(`Processing batch ${batchIndex + 1} of ${batches.length}: ${batch.length} polygons`);

      const batchResults: Array<Partial<IndicatorOutputHectares> | Partial<IndicatorOutputTreeCoverLoss>> = [];

      for (const polygonUuid of batch) {
        try {
          // forceRecalculation is true, so always process (no need to check if exists)
          const result = await this.indicatorService.processPolygon(slug, polygonUuid);
          if (result != null) {
            batchResults.push(result);
            successfulPolygons.push(polygonUuid);
          }
          processed++;
        } catch (error) {
          this.logger.error(
            `Error processing polygon ${polygonUuid} for slug ${slug}: ${
              error instanceof Error ? error.message : String(error)
            }`,
            error
          );
          processed++;
        }
      }

      // Save batch results immediately
      if (batchResults.length > 0) {
        await this.indicatorService.saveResults(batchResults, slug);
        allResults.push(...batchResults);
      }

      // Update progress after each batch
      await this.updateJobProgress(job, {
        processedContent: processed,
        progressMessage: `Analyzing ${processed} out of ${polygonUuids.length} polygons... (batch ${batchIndex + 1}/${
          batches.length
        })`
      });
    }

    const sitePolygons =
      successfulPolygons.length > 0
        ? await SitePolygon.findAll({
            where: {
              polygonUuid: {
                [Op.in]: successfulPolygons
              }
            }
          })
        : [];

    const document = buildJsonApi(SitePolygonLightDto);
    for (const sitePolygon of sitePolygons) {
      document.addData(sitePolygon.uuid, new SitePolygonLightDto(sitePolygon));
    }

    return {
      processedContent: successfulPolygons.length,
      progressMessage: `Completed indicators analysis${
        successfulPolygons.length < polygonUuids.length
          ? ` (${successfulPolygons.length}/${polygonUuids.length} successful)`
          : ""
      }`,
      payload: document
    };
  }

  /**
   * Process polygons one by one (used when forceRecalculation is false)
   * Updates progress after each polygon, regardless of updateExisting value
   */
  private async processOneByOne(
    job: Job<IndicatorsJobData>,
    slug: IndicatorSlug,
    polygonUuids: string[],
    updateExisting: boolean,
    forceRecalculation: boolean
  ) {
    let processed = 0;
    const successfulPolygons: string[] = [];
    const results: Array<Partial<IndicatorOutputHectares> | Partial<IndicatorOutputTreeCoverLoss>> = [];

    // Process polygons one by one to update progress after each (like PHP version)
    for (const polygonUuid of polygonUuids) {
      try {
        if (!updateExisting && !forceRecalculation) {
          const exists = await this.checkIfExists(slug, polygonUuid);
          if (exists) {
            this.logger.debug(
              `Skipping polygon ${polygonUuid} - record already exists and updateExisting=false, forceRecalculation=false`
            );
            processed++;
            await this.updateJobProgress(job, {
              processedContent: processed,
              progressMessage: `Analyzing ${processed} out of ${polygonUuids.length} polygons...`
            });
            continue;
          }
        }

        const result = await this.indicatorService.processPolygon(slug, polygonUuid);
        if (result != null) {
          results.push(result);
          successfulPolygons.push(polygonUuid);
        }
        processed++;

        // Update progress after each polygon (like PHP version updates periodically)
        await this.updateJobProgress(job, {
          processedContent: processed,
          progressMessage: `Analyzing ${processed} out of ${polygonUuids.length} polygons...`
        });
      } catch (error) {
        this.logger.error(
          `Error processing polygon ${polygonUuid} for slug ${slug}: ${
            error instanceof Error ? error.message : String(error)
          }`,
          error
        );
        processed++; // Count as processed even if failed
        // Continue processing other polygons even if one fails
        await this.updateJobProgress(job, {
          processedContent: processed,
          progressMessage: `Analyzing ${processed} out of ${polygonUuids.length} polygons...`
        });
      }
    }

    if (results.length > 0) {
      await this.indicatorService.saveResults(results, slug);
    }

    // Only fetch successful polygons for the response
    const sitePolygons =
      successfulPolygons.length > 0
        ? await SitePolygon.findAll({
            where: {
              polygonUuid: {
                [Op.in]: successfulPolygons
              }
            }
          })
        : [];

    const document = buildJsonApi(SitePolygonLightDto);

    for (const sitePolygon of sitePolygons) {
      document.addData(sitePolygon.uuid, new SitePolygonLightDto(sitePolygon));
    }

    return {
      processedContent: successfulPolygons.length,
      progressMessage: `Completed indicators analysis${
        successfulPolygons.length < polygonUuids.length
          ? ` (${successfulPolygons.length}/${polygonUuids.length} successful)`
          : ""
      }`,
      payload: document
    };
  }

  private async checkIfExists(slug: IndicatorSlug, polygonUuid: string): Promise<boolean> {
    const Model = SLUG_MAPPINGS[slug];
    if (Model == null) {
      return false;
    }

    const currentYear = new Date().getFullYear();

    const sitePolygon = await SitePolygon.findOne({
      where: { polygonUuid },
      attributes: ["id"]
    });

    if (sitePolygon == null) {
      return false;
    }

    const exists = await Model.findOne({
      where: {
        sitePolygonId: sitePolygon.id,
        indicatorSlug: slug,
        yearOfAnalysis: currentYear
      }
    });

    return exists != null;
  }
}

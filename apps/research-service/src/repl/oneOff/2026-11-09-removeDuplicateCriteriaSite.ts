import { getService } from "@terramatch-microservices/common/util/bootstrap-repl";
import { withoutSqlLogs } from "@terramatch-microservices/common/util/repl/without-sql-logs";
import { TMLogger } from "@terramatch-microservices/common/util/tm-logger";
import { CriteriaSite, CriteriaSiteHistoric, PolygonGeometry } from "@terramatch-microservices/database/entities";
import { chunk, uniq } from "lodash";
import ProgressBar from "progress";
import { CreationAttributes, literal } from "sequelize";
import { ValidationService } from "../../validations/validation.service";

const logger = new TMLogger("removeDuplicateCriteriaSite");

const DEFAULT_BATCH_SIZE = 500;

const HAS_NEWER_ROW = literal(
  `EXISTS (SELECT 1 FROM criteria_site newer
    WHERE newer.polygon_id = CriteriaSite.polygon_id
      AND newer.criteria_id = CriteriaSite.criteria_id
      AND (newer.created_at > CriteriaSite.created_at
        OR (newer.created_at = CriteriaSite.created_at AND newer.id > CriteriaSite.id)))`
);

export type RemoveDuplicateCriteriaSiteOptions = {
  /** Rows moved per batch. Default 500. */
  batchSize?: number;
  /** When true, report counts without writing. */
  dryRun?: boolean;
};

export type RemoveDuplicateCriteriaSiteSummary = {
  dryRun: boolean;
  staleRows: number;
  polygons: number;
};

/**
 * One-off (REPL): TM-4198. Keeps the newest `criteria_site` row per polygon + criteria, moves older duplicates to
 * `criteria_site_historic` and recalculates `validationStatus`. Safe to re-run.
 */
export const removeDuplicateCriteriaSite = withoutSqlLogs(
  async (options: RemoveDuplicateCriteriaSiteOptions = {}): Promise<RemoveDuplicateCriteriaSiteSummary> => {
    const dryRun = options.dryRun === true;
    const batchSize = options.batchSize ?? DEFAULT_BATCH_SIZE;

    const staleRows = await CriteriaSite.findAll({
      where: HAS_NEWER_ROW,
      attributes: ["id", "polygonId"],
      order: [["id", "ASC"]]
    });
    const polygonIds = uniq(staleRows.map(({ polygonId }) => polygonId));
    const summary: RemoveDuplicateCriteriaSiteSummary = {
      dryRun,
      staleRows: staleRows.length,
      polygons: polygonIds.length
    };

    logger.log(`Found ${summary.staleRows} stale rows on ${summary.polygons} polygons${dryRun ? " (dryRun)" : ""}`);
    if (dryRun || staleRows.length === 0) return summary;

    const validationService = getService(ValidationService);
    const bar = new ProgressBar("Removing duplicate criteria_site rows [:bar] :current/:total :percent :etas", {
      width: 40,
      total: staleRows.length
    });

    for (const ids of chunk(
      staleRows.map(({ id }) => id),
      batchSize
    )) {
      const rows = await CriteriaSite.findAll({
        where: { id: ids },
        attributes: ["id", "polygonId", "criteriaId", "valid", "extraInfo"]
      });

      await PolygonGeometry.sql.transaction(async transaction => {
        await CriteriaSiteHistoric.bulkCreate(
          rows.map(
            ({ polygonId, criteriaId, valid, extraInfo }) =>
              ({ polygonId, criteriaId, valid, extraInfo }) as CreationAttributes<CriteriaSiteHistoric>
          ),
          { transaction }
        );
        await CriteriaSite.destroy({ where: { id: ids }, transaction });
      });

      await validationService.updateSitePolygonValidityBatch(uniq(rows.map(({ polygonId }) => polygonId)));
      bar.tick(ids.length);
    }

    logger.log(`Removed ${summary.staleRows} stale rows on ${summary.polygons} polygons`);
    return summary;
  }
);

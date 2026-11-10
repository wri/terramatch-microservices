import { withoutSqlLogs } from "@terramatch-microservices/common/util/repl/without-sql-logs";
import { getService } from "@terramatch-microservices/common/util/bootstrap-repl";
import { SitePolygon } from "@terramatch-microservices/database/entities";
import { QueryTypes } from "sequelize";
import { PolygonGeometryCreationService } from "../../site-polygons/polygon-geometry-creation.service";

type StaleCentroidRow = { id: number; polyId: string };

// About 1 cm at the equator; anything further off was left behind by a geometry edit.
const CENTROID_TOLERANCE_DEGREES = 1e-7;

/**
 * Until TM-4197, a geometry edit created the new site polygon version with the previous version's lat / long,
 * so the map issue icons stayed where the old shape was. Recomputes lat / long from the geometry for every site
 * polygon whose stored centroid doesn't match it, then recomputes the centroids of the affected projects.
 * Polygons without a stored centroid are left alone.
 *
 * Run in research-service REPL:
 *   await oneOff.backfillSitePolygonCentroids()
 *   await oneOff.backfillSitePolygonCentroids({ dryRun: false })
 *
 * Safe to re-run.
 */
export const backfillSitePolygonCentroids = withoutSqlLogs(
  async (options?: { dryRun?: boolean; batchSize?: number }) => {
    const dryRun = options?.dryRun !== false;
    const batchSize = options?.batchSize ?? 500;
    const polygonGeometryService = getService(PolygonGeometryCreationService);

    let afterId = 0;
    let staleCount = 0;
    while (true) {
      const rows = await SitePolygon.sql.query<StaleCentroidRow>(
        `
          SELECT sp.id, sp.poly_id AS polyId
          FROM site_polygon sp
          JOIN polygon_geometry pg ON pg.uuid = sp.poly_id
          WHERE sp.id > :afterId
            AND sp.deleted_at IS NULL
            AND pg.geom IS NOT NULL
            AND sp.lat IS NOT NULL
            AND sp.long IS NOT NULL
            AND (
              ABS(sp.lat - ST_Y(ST_Centroid(pg.geom))) > :tolerance
              OR ABS(sp.long - ST_X(ST_Centroid(pg.geom))) > :tolerance
            )
          ORDER BY sp.id
          LIMIT :batchSize
        `,
        { replacements: { afterId, batchSize, tolerance: CENTROID_TOLERANCE_DEGREES }, type: QueryTypes.SELECT }
      );
      if (rows.length === 0) break;

      afterId = rows[rows.length - 1].id;
      staleCount += rows.length;
      if (!dryRun) {
        const polyIds = [...new Set(rows.map(({ polyId }) => polyId))];
        await polygonGeometryService.bulkUpdateSitePolygonCentroids(polyIds);
        await polygonGeometryService.bulkUpdateProjectCentroids(polyIds);
      }
      console.log(`${dryRun ? "Found" : "Fixed"} ${staleCount} stale site polygon centroids so far`);
    }

    console.log(`Done: ${staleCount} stale site polygon centroids ${dryRun ? "found (dry run)" : "fixed"}`);
    return { dryRun, staleCount };
  }
);

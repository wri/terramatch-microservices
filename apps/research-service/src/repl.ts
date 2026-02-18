import { AppModule } from "./app.module";
import { bootstrapRepl } from "@terramatch-microservices/common/util/bootstrap-repl";
import { CriteriaSite, SitePolygon } from "@terramatch-microservices/database/entities";
import { VALIDATION_CRITERIA_IDS } from "@terramatch-microservices/database/constants";
import { PaginatedQueryBuilder } from "@terramatch-microservices/common/util/paginated-query.builder";
import { batchFindAll } from "@terramatch-microservices/common/util/batch-find-all";
import { withoutSqlLogs } from "@terramatch-microservices/common/util/without-sql-logs";
import ProgressBar from "progress";
import { EstimatedAreaValidator } from "./validations/validators/estimated-area.validator";
import { Op } from "sequelize";

bootstrapRepl("Research Service", AppModule, {
  // One off scripts for running in the REPL. Should be cleared out occasionally once they've been
  // run in all relevant environments.
  oneOff: {
    // Updates all criteria_site records with criteria_id=12 (ESTIMATED_AREA) using the new
    // EstimatedAreaValidator. Only processes records that have an active site_polygon.
    // https://gfw.atlassian.net/browse/TM-2760. May be removed after running in production.
    updateEstimatedAreaValidation: withoutSqlLogs(async () => {
      const validator = new EstimatedAreaValidator();

      const activeSitePolygons = await SitePolygon.findAll({
        where: { isActive: true },
        attributes: ["polygonUuid"],
        raw: true
      });

      const activePolygonIds = activeSitePolygons.map(sp => sp.polygonUuid).filter(Boolean);

      console.log(`Found ${activePolygonIds.length} active site polygons`);

      const builder = new PaginatedQueryBuilder(CriteriaSite, 100).where({
        criteriaId: VALIDATION_CRITERIA_IDS.ESTIMATED_AREA,
        polygonId: { [Op.in]: activePolygonIds }
      });

      const totalRecords = await builder.paginationTotal();
      console.log(`Found ${totalRecords} criteria_site records to update`);

      const bar = new ProgressBar("Updating ESTIMATED_AREA validations [:bar] :percent :etas", {
        width: 40,
        total: totalRecords
      });

      let successCount = 0;
      let errorCount = 0;
      const errors: Array<{ polygonId: string; error: string }> = [];

      for await (const page of batchFindAll(builder)) {
        for (const criteriaSite of page) {
          try {
            const result = await validator.validatePolygon(criteriaSite.polygonId);

            criteriaSite.valid = result.valid;
            criteriaSite.extraInfo = result.extraInfo;
            await criteriaSite.save();

            successCount++;
          } catch (error) {
            errorCount++;
            errors.push({
              polygonId: criteriaSite.polygonId,
              error: error instanceof Error ? error.message : "Unknown error"
            });
          }

          bar.tick();
        }
      }

      console.log("\n=== Update Complete ===");
      console.log(`Total records: ${totalRecords}`);
      console.log(`Successfully updated: ${successCount}`);
      console.log(`Failed: ${errorCount}`);

      if (errors.length > 0) {
        console.log("\nErrors encountered:");
        errors.forEach(({ polygonId, error }) => {
          console.log(`  - Polygon ${polygonId}: ${error}`);
        });
      }
    })
  }
});

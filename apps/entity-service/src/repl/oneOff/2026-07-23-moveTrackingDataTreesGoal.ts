import { withoutSqlLogs } from "@terramatch-microservices/common/util/repl/without-sql-logs";
import { PaginatedQueryBuilder } from "@terramatch-microservices/common/util/paginated-query.builder";
import { Tracking, TrackingEntry } from "@terramatch-microservices/database/entities";
import ProgressBar from "progress";
import { batchFindAll } from "@terramatch-microservices/common/util/batch-find-all";

export const moveTrackingDataTreesGoal = withoutSqlLogs(async () => {
  const builder = new PaginatedQueryBuilder(Tracking, 10, [{ association: "entries" }]).where({ type: "trees-goal" });
  const total = await builder.paginationTotal();
  const bar = new ProgressBar(`Processing ${total} trees-goal trackings [:bar] :percent :etas`, { width: 40, total });
  for await (const page of batchFindAll(builder)) {
    for (const tracking of page) {
      const yearEntries = (tracking.entries ?? []).filter(({ type }) => type === "years");
      if (yearEntries.length > 0) {
        const { domain, collection, hidden, trackableType, trackableId } = tracking;
        const treePlantedGoal = await Tracking.create({
          domain,
          collection,
          trackableType,
          trackableId,
          hidden,
          type: "trees-planted-goal"
        });

        await TrackingEntry.update(
          { trackingId: treePlantedGoal.id },
          { where: { id: yearEntries.map(({ id }) => id) } }
        );
      }

      bar.tick();
    }
  }
});

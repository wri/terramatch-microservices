import { withoutSqlLogs } from "@terramatch-microservices/common/util/repl/without-sql-logs";
import { PaginatedQueryBuilder } from "@terramatch-microservices/common/util/paginated-query.builder";
import { Op } from "sequelize";
import { Organisation, ProjectPitch } from "@terramatch-microservices/database/entities";
import ProgressBar from "progress";
import { batchFindAll } from "@terramatch-microservices/common/util/batch-find-all";

export const migrateConsortium = withoutSqlLogs(async () => {
  const builder = new PaginatedQueryBuilder(Organisation, 100)
    .where({
      consortium: { [Op.not]: null }
    })
    .attributes(["uuid", "consortium"]);
  const total = await builder.paginationTotal();
  const bar = new ProgressBar(`Processing ${total} Organisations [:bar] :percent :etas`, { width: 40, total });
  for await (const page of batchFindAll(builder)) {
    for (const org of page) {
      const pitches = await ProjectPitch.findAll({
        where: { organisationId: org.uuid }
      });
      for (const pitch of pitches) {
        await pitch.update({ consortium: org.consortium });
      }

      bar.tick();
    }
  }
});

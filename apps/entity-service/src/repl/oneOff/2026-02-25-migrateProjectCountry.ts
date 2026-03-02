import { withoutSqlLogs } from "@terramatch-microservices/common/util/repl/without-sql-logs";
import { PaginatedQueryBuilder } from "@terramatch-microservices/common/util/paginated-query.builder";
import { Project } from "@terramatch-microservices/database/entities";
import { Op } from "sequelize";
import ProgressBar from "progress";
import { batchFindAll } from "@terramatch-microservices/common/util/batch-find-all";
import { isEqual } from "lodash";

export const migrateProjectCountry = withoutSqlLogs(async () => {
  const builder = new PaginatedQueryBuilder(Project, 10)
    .attributes(["id", "country"])
    .where({ country: { [Op.not]: null } });
  const total = await builder.paginationTotal();
  const bar = new ProgressBar(`Processing ${total} Projects [:bar] :percent :etas`, { width: 40, total });
  const warnings: string[] = [];
  for await (const page of batchFindAll(builder)) {
    for (const project of page) {
      if (project.level0Project != null && !isEqual(project.level0Project, [project.country])) {
        warnings.push(
          `Project ${project.id} has level0Project ${project.level0Project} but country ${project.country}`
        );
      } else {
        await project.update({ level0Project: [project.country as string] });
      }
      bar.tick();
    }
  }

  if (warnings.length > 0) {
    console.log("Warnings:");
    console.log(warnings.join("\n"));
  }

  console.log("Finished processing projects");
});

import { withoutSqlLogs } from "@terramatch-microservices/common/util/repl/without-sql-logs";
import { PaginatedQueryBuilder } from "@terramatch-microservices/common/util/paginated-query.builder";
import { FormOptionListOption, FormQuestionOption } from "@terramatch-microservices/database/entities";
import { Op } from "sequelize";
import ProgressBar from "progress";
import { batchFindAll } from "@terramatch-microservices/common/util/batch-find-all";

export const updateImageUrls = withoutSqlLogs(async () => {
  await updatePaths(
    "FromQuestionOption",
    new PaginatedQueryBuilder(FormQuestionOption, 10).where({ imageUrl: { [Op.not]: null } })
  );
  await updatePaths(
    "FormOptionListOption",
    new PaginatedQueryBuilder(FormOptionListOption, 10).where({ imageUrl: { [Op.not]: null } })
  );
});

const updatePaths = async (type: string, builder: PaginatedQueryBuilder<FormQuestionOption | FormOptionListOption>) => {
  const total = await builder.paginationTotal();
  const bar = new ProgressBar(`Updating ${total} ${type} imageUrls [:bar] :percent :etas`, { total, width: 40 });
  for await (const page of batchFindAll(builder)) {
    for (const option of page) {
      option.imageUrl = option.imageUrl?.replace(/.*images\/V2\//, "/images/options/") ?? null;
      await option.save();
      bar.tick();
    }
  }
};

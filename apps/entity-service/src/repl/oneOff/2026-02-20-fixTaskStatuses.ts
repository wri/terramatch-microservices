import { withoutSqlLogs } from "@terramatch-microservices/common/util/repl/without-sql-logs";
import { PaginatedQueryBuilder } from "@terramatch-microservices/common/util/paginated-query.builder";
import { Task } from "@terramatch-microservices/database/entities";
import ProgressBar from "progress";
import { batchFindAll } from "@terramatch-microservices/common/util/batch-find-all";
import { ReportModel } from "@terramatch-microservices/database/constants/entities";
import { flatten, uniq } from "lodash";
import { isNotNull } from "@terramatch-microservices/database/types/array";
import {
  APPROVED,
  DRAFT,
  DUE,
  INFORMATION_REQUIRED,
  PENDING_APPROVAL
} from "@terramatch-microservices/database/constants/status";

export const fixTaskStatuses = withoutSqlLogs(async () => {
  const attributes = ["id", "status", "updateRequestStatus"];
  const builder = new PaginatedQueryBuilder(Task, 10, [
    { association: "projectReport", attributes },
    { association: "siteReports", attributes },
    { association: "nurseryReports", attributes },
    { association: "srpReports", attributes }
  ]).where({ status: "due" });
  const total = await builder.paginationTotal();
  const bar = new ProgressBar(`Processing ${total} Tasks [:bar] :percent :etas`, { width: 40, total });
  const approved: number[] = [];
  const moreInfo: number[] = [];
  const pendingApproval: number[] = [];
  for await (const page of batchFindAll(builder)) {
    for (const task of page) {
      // Duplicates the logic from EntityStatusUpdate.checkTaskStatus.
      const reports = flatten<ReportModel | null>([
        task.projectReport,
        task.siteReports,
        task.nurseryReports,
        task.srpReports
      ]).filter(isNotNull);
      const reportStatuses = uniq(reports.map(({ status }) => status));
      const moreInfoReport = reports.find(
        ({ status, updateRequestStatus }) =>
          (status === INFORMATION_REQUIRED && updateRequestStatus !== PENDING_APPROVAL) ||
          updateRequestStatus === INFORMATION_REQUIRED
      );

      if (reportStatuses.length === 1 && reportStatuses[0] === APPROVED) {
        approved.push(task.id);
      } else if (reportStatuses.includes(DUE) || reportStatuses.includes(DRAFT)) {
        // NOOP
      } else if (moreInfoReport != null) {
        moreInfo.push(task.id);
      } else {
        pendingApproval.push(task.id);
      }

      bar.tick();
    }
  }

  // Do the updates in bulk for performance and to avoid messing with the pagination cursor due
  // to the pagination working on the status = due.
  await Task.update({ status: APPROVED }, { where: { id: approved } });
  await Task.update({ status: INFORMATION_REQUIRED }, { where: { id: moreInfo } });
  await Task.update({ status: PENDING_APPROVAL }, { where: { id: pendingApproval } });

  console.log(
    `\nTasks updated: [approved=${approved.length}, information-required=${moreInfo.length}, pending-approval=${pendingApproval.length}]`
  );
});

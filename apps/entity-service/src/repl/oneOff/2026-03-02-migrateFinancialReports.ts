import { withoutSqlLogs } from "@terramatch-microservices/common/util/repl/without-sql-logs";
import { FinancialReport, Project } from "@terramatch-microservices/database/entities";
import { Op } from "sequelize";
import ProgressBar from "progress";
import { PaginatedQueryBuilder } from "@terramatch-microservices/common/util/paginated-query.builder";
import { batchFindAll } from "@terramatch-microservices/common/util/batch-find-all";

/**
 * One-off script to migrate financial reports:
 *
 * 1) Copy v2_projects.framework_key -> financial_reports.framework_key
 * 2) Delete financial_reports for frameworks that should not have reports
 * 3) Update due_at for 2026 reports based on framework_key
 *
 * Assumptions:
 * - financial_reports.organisationId matches v2_projects.organisationId
 * - The first project (lowest id) per organisation has the correct framework_key
 */
export const migrateFinancialReports = withoutSqlLogs(async () => {
  console.log("Step 1: Populating financial_reports.framework_key from v2_projects.framework_key...");

  const builder = new PaginatedQueryBuilder(FinancialReport, 100).where({ deletedAt: null });
  const total = await builder.paginationTotal();

  const bar = new ProgressBar("Updating framework_key [:bar] :percent :etas", {
    width: 40,
    total
  });

  let updatedCount = 0;
  let missingProjectCount = 0;

  for await (const page of batchFindAll(builder)) {
    for (const report of page) {
      if (report.frameworkKey != null) {
        bar.tick();
        continue;
      }

      const project = await Project.findOne({
        where: { organisationId: report.organisationId },
        attributes: ["id", "frameworkKey"],
        order: [["id", "ASC"]]
      });

      if (project != null && project.frameworkKey != null) {
        report.frameworkKey = project.frameworkKey;
        await report.save();
        updatedCount++;
      } else {
        missingProjectCount++;
      }

      bar.tick();
    }
  }

  console.log(
    `\nFrameworks populated on financial_reports: updated=${updatedCount}, reportsWithoutProjectFramework=${missingProjectCount}`
  );

  console.log("\nStep 2: Deleting financial_reports for frameworks that should not have reports...");

  const deleteResult = await FinancialReport.destroy({
    where: {
      deletedAt: null,
      frameworkKey: {
        [Op.notIn]: ["enterprises", "terrafund-landscapes"]
      }
    }
  });

  console.log(`Soft-deleted financial_reports outside allowed frameworks: ${deleteResult}`);

  console.log("\nStep 3: Updating due_at for 2026 financial reports by framework_key...");

  // terrafund-landscapes -> March 15th 2026
  const tfLandscapesResult = await FinancialReport.update(
    {
      dueAt: new Date(2026, 2, 15) // months are 0-based: 2 = March
    },
    {
      where: {
        deletedAt: null,
        frameworkKey: "terrafund-landscapes",
        yearOfReport: 2026
      }
    }
  );

  // enterprises -> July 30th 2026
  const enterprisesResult = await FinancialReport.update(
    {
      dueAt: new Date(2026, 6, 30) // 6 = July
    },
    {
      where: {
        deletedAt: null,
        frameworkKey: "enterprises",
        yearOfReport: 2026
      }
    }
  );

  console.log(
    `Updated due_at for 2026 reports: terrafund-landscapes=${tfLandscapesResult[0]}, enterprises=${enterprisesResult[0]}`
  );

  console.log("\nMigration complete.");
});

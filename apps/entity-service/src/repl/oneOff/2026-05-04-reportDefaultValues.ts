import { withoutSqlLogs } from "@terramatch-microservices/common/util/repl/without-sql-logs";
import { ProjectReport, SiteReport } from "@terramatch-microservices/database/entities";
import { NULLABLE_COLUMNS } from "@terramatch-microservices/database/migrations/202605041703-make-assorted-columns-nullable";

export const reportDefaultValues = withoutSqlLogs(async () => {
  const projectReportAttributes = ProjectReport.getAttributes();
  for (const column of NULLABLE_COLUMNS.projectReports) {
    const { type } = projectReportAttributes[column];
    if (type.toSql() === "TEXT") {
      const [count] = await ProjectReport.update({ [column]: null }, { where: { [column]: "" } });
      console.log(`Updated ${count} project reports for column ${column}`);
    } else if (type.toSql() === "INTEGER UNSIGNED") {
      const [count] = await ProjectReport.update({ [column]: null }, { where: { [column]: 0 } });
      console.log(`Updated ${count} project reports for column ${column}`);
    } else {
      console.error("Unknown column type", type);
    }
  }

  const siteReportAttributes = SiteReport.getAttributes();
  for (const column of NULLABLE_COLUMNS.siteReports) {
    const { type } = siteReportAttributes[column];
    if (type.toSql() === "TEXT") {
      const [count] = await SiteReport.update({ [column]: null }, { where: { [column]: "" } });
      console.log(`Updated ${count} site reports for column ${column}`);
    } else if (type.toSql() === "INTEGER UNSIGNED") {
      const [count] = await SiteReport.update({ [column]: null }, { where: { [column]: 0 } });
      console.log(`Updated ${count} site reports for column ${column}`);
    } else {
      console.error("Unknown column type", type);
    }
  }
});

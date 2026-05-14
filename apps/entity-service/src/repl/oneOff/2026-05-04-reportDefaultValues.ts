import { withoutSqlLogs } from "@terramatch-microservices/common/util/repl/without-sql-logs";
import { ProjectReport, SiteReport } from "@terramatch-microservices/database/entities";
import { NULLABLE_COLUMNS } from "@terramatch-microservices/database/migrations/202605041703-make-assorted-columns-nullable";
import { AbstractDataType, Attributes, DataType } from "sequelize";

const isAbstractDataType = (type?: DataType): type is AbstractDataType =>
  type != null && "toSql" in (type as AbstractDataType);

export const reportDefaultValues = withoutSqlLogs(async () => {
  const projectReportAttributes = ProjectReport.getAttributes();
  for (const column of NULLABLE_COLUMNS.projectReports) {
    const type = projectReportAttributes[column as keyof Attributes<ProjectReport>]?.type;
    if (!isAbstractDataType(type)) continue;

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
    const type = siteReportAttributes[column as keyof Attributes<SiteReport>]?.type;
    if (!isAbstractDataType(type)) continue;
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

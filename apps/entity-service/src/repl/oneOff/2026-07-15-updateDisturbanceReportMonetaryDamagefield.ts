import { withoutSqlLogs } from "@terramatch-microservices/common/util/repl/without-sql-logs";
import { DisturbanceReportEntry } from "@terramatch-microservices/database/entities";

export const updateDisturbanceReportMonetaryDamageField = withoutSqlLogs(async () => {
  const [affectedRows] = await DisturbanceReportEntry.update(
    {
      name: "financial-loss",
      title: "Financial Loss"
    },
    {
      where: {
        name: "monetary-damage"
      }
    }
  );

  console.log(`Updated ${affectedRows} disturbance report entries`);
});

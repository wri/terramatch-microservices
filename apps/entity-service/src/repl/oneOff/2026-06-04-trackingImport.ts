import { withoutSqlLogs } from "@terramatch-microservices/common/util/repl/without-sql-logs";
import { columnValue, parseCsv } from "@terramatch-microservices/common/util/repl/csv";
import { Dictionary } from "lodash";
import { assertMember, assertNotNull, assertNumber } from "@terramatch-microservices/common/util/repl/assertions";
import { Tracking, TrackingEntry } from "@terramatch-microservices/database/entities";
import { TrackingDomain, TrackingType } from "@terramatch-microservices/database/types/tracking";

type TrackingCsvRow = {
  trackableType: string;
  trackableId: number;
  domain: TrackingDomain;
  type: TrackingType;
  collection: string;
  amount: number;
};

export const trackingImport = withoutSqlLogs(async (csvPath: string) => {
  let rowCount = 0;
  try {
    await parseCsv(csvPath, async row => {
      const trackableRow = parseRow(row);
      const { amount, ...trackingAttributes } = trackableRow;

      const tracking = await Tracking.create(trackingAttributes);
      await TrackingEntry.bulkCreate(
        ["gender", "age"].map(type => ({
          trackingId: tracking.id,
          type,
          subtype: "unknown",
          amount
        }))
      );

      rowCount++;
    });
  } catch (e) {
    console.error(`Error importing tracking data from CSV [${e}]`);
  }

  console.log(`Imported ${rowCount} rows from ${csvPath}`);
});

const parseRow = (row: Dictionary<string>): TrackingCsvRow => {
  const trackableType = assertNotNull(columnValue(row, "trackableType"), "trackableType not found");
  const trackableId = assertNumber(columnValue(row, "trackableId"), "trackableId not found");
  const domain = assertMember(columnValue(row, "domain"), Tracking.DOMAINS, "domain not found") as TrackingDomain;
  const type = assertMember(columnValue(row, "type"), Tracking.VALID_TYPES, "type not found") as TrackingType;
  const collection = assertNotNull(columnValue(row, "collection"), "collection not found");
  const amount = assertNumber(columnValue(row, "amount"), "amount not found");
  return { trackableType, trackableId, domain, type, collection, amount };
};

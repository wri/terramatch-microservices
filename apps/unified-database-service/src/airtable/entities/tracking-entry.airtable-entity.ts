import { Tracking, TrackingEntry } from "@terramatch-microservices/database/entities";
import { AirtableEntity, associatedValueColumn, ColumnMapping } from "./airtable-entity";
import { uniq } from "lodash";

type TrackingEntryAssociations = {
  trackingUuid?: string;
};

const COLUMNS: ColumnMapping<TrackingEntry, TrackingEntryAssociations>[] = [
  "id",
  "type",
  "subtype",
  "name",
  "amount",
  associatedValueColumn("trackingUuid", "trackingId")
];

export class TrackingEntryEntity extends AirtableEntity<TrackingEntry, TrackingEntryAssociations> {
  readonly TABLE_NAME = "Tracking Entries";
  readonly COLUMNS = COLUMNS;
  readonly MODEL = TrackingEntry;
  readonly IDENTITY_COLUMN = "id";

  protected async loadAssociations(entries: TrackingEntry[]) {
    const trackingIds = uniq(entries.map(({ trackingId }) => trackingId));
    const trackings = await Tracking.findAll({
      where: { id: trackingIds },
      attributes: ["id", "uuid"]
    });

    return entries.reduce(
      (associations, { id, trackingId }) => ({
        ...associations,
        [id]: { trackingUuid: trackings.find(({ id }) => id === trackingId)?.uuid }
      }),
      {} as Record<number, TrackingEntryAssociations>
    );
  }
}

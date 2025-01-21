import { Demographic, RestorationPartner, Workday } from "@terramatch-microservices/database/entities";
import { AirtableEntity, associatedValueColumn, ColumnMapping, PolymorphicUuidAssociation } from "./airtable-entity";

const LARAVEL_TYPE_MAPPINGS: Record<string, PolymorphicUuidAssociation<DemographicAssociations>> = {
  [Workday.LARAVEL_TYPE]: {
    association: "workdayUuid",
    model: Workday
  },
  [RestorationPartner.LARAVEL_TYPE]: {
    association: "restorationPartnerUuid",
    model: RestorationPartner
  }
};

type DemographicAssociations = {
  workdayUuid?: string;
  restorationPartnerUuid?: string;
};

const COLUMNS: ColumnMapping<Demographic, DemographicAssociations>[] = [
  "id",
  "type",
  "subtype",
  "name",
  "amount",
  associatedValueColumn("workdayUuid", ["demographicalType", "demographicalId"]),
  associatedValueColumn("restorationPartnerUuid", ["demographicalType", "demographicalId"])
];

export class DemographicEntity extends AirtableEntity<Demographic, DemographicAssociations> {
  readonly TABLE_NAME = "Demographics";
  readonly COLUMNS = COLUMNS;
  readonly MODEL = Demographic;
  readonly IDENTITY_COLUMN = "id";

  protected async loadAssociations(demographics: Demographic[]) {
    return this.loadPolymorphicUuidAssociations(
      LARAVEL_TYPE_MAPPINGS,
      "demographicalType",
      "demographicalId",
      demographics
    );
  }
}

import {
  AirtableEntity,
  associatedValueColumn,
  ColumnMapping,
  commonEntityColumns,
  PolymorphicUuidAssociation
} from "./airtable-entity";
import { Invasive, Site } from "@terramatch-microservices/database/entities";

const LARAVEL_TYPE_MAPPING: Record<string, PolymorphicUuidAssociation<InvasiveAssociations>> = {
  [Site.LARAVEL_TYPE]: {
    association: "siteUuid",
    model: Site
  }
};

type InvasiveAssociations = {
  siteUuid?: string;
};

const COLUMNS: ColumnMapping<Invasive, InvasiveAssociations>[] = [
  ...commonEntityColumns<Invasive, InvasiveAssociations>(),
  "type",
  "name",
  associatedValueColumn("siteUuid", ["invasiveableId", "invasiveableType"])
];

export class InvasiveEntity extends AirtableEntity<Invasive, InvasiveAssociations> {
  readonly TABLE_NAME = "Invasives";
  readonly COLUMNS = COLUMNS;
  readonly MODEL = Invasive;
  readonly FILTER_FLAGS = ["hidden"];

  protected async loadAssociations(stratas: Invasive[]) {
    return this.loadPolymorphicUuidAssociations(LARAVEL_TYPE_MAPPING, "invasiveableType", "invasiveableId", stratas);
  }
}

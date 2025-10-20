/* istanbul ignore file */
import {
  AirtableEntity,
  associatedValueColumn,
  ColumnMapping,
  commonEntityColumns,
  percentageColumn,
  PolymorphicUuidAssociation
} from "./airtable-entity";
import { Site, Strata } from "@terramatch-microservices/database/entities";

const LARAVEL_TYPE_MAPPING: Record<string, PolymorphicUuidAssociation<StrataAssociations>> = {
  [Site.LARAVEL_TYPE]: {
    association: "siteUuid",
    model: Site
  }
};

type StrataAssociations = {
  siteUuid?: string;
};

const COLUMNS: ColumnMapping<Strata, StrataAssociations>[] = [
  ...commonEntityColumns<Strata, StrataAssociations>(),
  "description",
  percentageColumn("extent"),
  associatedValueColumn("siteUuid", ["stratasableId", "stratasableType"])
];

export class StrataEntity extends AirtableEntity<Strata, StrataAssociations> {
  readonly TABLE_NAME = "Stratas";
  readonly COLUMNS = COLUMNS;
  readonly MODEL = Strata;
  readonly FILTER_FLAGS = ["hidden"];

  protected async loadAssociations(stratas: Strata[]) {
    return this.loadPolymorphicUuidAssociations(LARAVEL_TYPE_MAPPING, "stratasableType", "stratasableId", stratas);
  }
}

/* istanbul ignore file */
import {
  AirtableEntity,
  associatedValueColumn,
  ColumnMapping,
  commonEntityColumns,
  PolymorphicUuidAssociation
} from "./airtable-entity";
import { Seeding, Site, SiteReport } from "@terramatch-microservices/database/entities";

const LARAVEL_TYPE_MAPPING: Record<string, PolymorphicUuidAssociation<SeedingAssociations>> = {
  [Site.LARAVEL_TYPE]: {
    association: "siteUuid",
    model: Site
  },
  [SiteReport.LARAVEL_TYPE]: {
    association: "siteReportUuid",
    model: SiteReport
  }
};

type SeedingAssociations = {
  siteUuid?: string;
  siteReportUuid?: string;
};

const COLUMNS: ColumnMapping<Seeding, SeedingAssociations>[] = [
  ...commonEntityColumns<Seeding, SeedingAssociations>(),
  "name",
  "weightOfSample",
  "amount",
  "seedsInSample",
  associatedValueColumn("siteUuid", ["seedableId", "seedableType"]),
  associatedValueColumn("siteReportUuid", ["seedableId", "seedableType"])
];

export class SeedingEntity extends AirtableEntity<Seeding, SeedingAssociations> {
  readonly TABLE_NAME = "Seedings";
  readonly COLUMNS = COLUMNS;
  readonly MODEL = Seeding;
  readonly FILTER_FLAGS = ["hidden"];

  protected async loadAssociations(seedings: Seeding[]) {
    return this.loadPolymorphicUuidAssociations(LARAVEL_TYPE_MAPPING, "seedableType", "seedableId", seedings);
  }
}

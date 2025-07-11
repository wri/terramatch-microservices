/* istanbul ignore file */
import {
  AirtableEntity,
  associatedValueColumn,
  ColumnMapping,
  commonEntityColumns,
  PolymorphicUuidAssociation
} from "./airtable-entity";
import { Disturbance, Site, SiteReport } from "@terramatch-microservices/database/entities";

const LARAVEL_TYPE_MAPPING: Record<string, PolymorphicUuidAssociation<DisturbanceAssociations>> = {
  [Site.LARAVEL_TYPE]: {
    association: "siteUuid",
    model: Site
  },
  [SiteReport.LARAVEL_TYPE]: {
    association: "siteReportUuid",
    model: SiteReport
  }
};

type DisturbanceAssociations = {
  siteUuid?: string;
  siteReportUuid?: string;
};

const COLUMNS: ColumnMapping<Disturbance, DisturbanceAssociations>[] = [
  ...commonEntityColumns<Disturbance, DisturbanceAssociations>(),
  "disturbanceDate",
  "type",
  "subtype",
  "intensity",
  "extent",
  "peopleAffected",
  "monetaryDamage",
  "description",
  "actionDescription",
  "propertyAffected",
  associatedValueColumn("siteUuid", ["disturbanceableId", "disturbanceableType"]),
  associatedValueColumn("siteReportUuid", ["disturbanceableId", "disturbanceableType"])
];

export class DisturbanceEntity extends AirtableEntity<Disturbance, DisturbanceAssociations> {
  readonly TABLE_NAME = "Disturbances";
  readonly COLUMNS = COLUMNS;
  readonly MODEL = Disturbance;
  readonly FILTER_FLAGS = ["hidden"];

  protected async loadAssociations(disturbances: Disturbance[]) {
    return this.loadPolymorphicUuidAssociations(
      LARAVEL_TYPE_MAPPING,
      "disturbanceableType",
      "disturbanceableId",
      disturbances
    );
  }
}

import { AirtableEntity, associatedValueColumn, ColumnMapping, PolymorphicUuidAssociation } from "./airtable-entity";
import { ProjectReport, SiteReport, Demographic } from "@terramatch-microservices/database/entities";

const LARAVEL_TYPE_MAPPINGS: Record<string, PolymorphicUuidAssociation<DemographicAssociations>> = {
  [ProjectReport.LARAVEL_TYPE]: {
    association: "projectReportUuid",
    model: ProjectReport
  },
  [SiteReport.LARAVEL_TYPE]: {
    association: "siteReportUuid",
    model: SiteReport
  }
};

type DemographicAssociations = {
  projectReportUuid?: string;
  siteReportUuid?: string;
};

const COLUMNS: ColumnMapping<Demographic, DemographicAssociations>[] = [
  "uuid",
  "type",
  "collection",
  "description",
  associatedValueColumn("projectReportUuid", ["demographicalId", "demographicalType"]),
  associatedValueColumn("siteReportUuid", ["demographicalId", "demographicalType"])
];

export class DemographicEntity extends AirtableEntity<Demographic, DemographicAssociations> {
  readonly TABLE_NAME = "Demographics";
  readonly COLUMNS = COLUMNS;
  readonly MODEL = Demographic;
  readonly FILTER_FLAGS = ["hidden"];

  protected async loadAssociations(demographics: Demographic[]) {
    return this.loadPolymorphicUuidAssociations(
      LARAVEL_TYPE_MAPPINGS,
      "demographicalType",
      "demographicalId",
      demographics
    );
  }
}

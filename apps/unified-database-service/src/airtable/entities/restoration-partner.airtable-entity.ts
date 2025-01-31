import { AirtableEntity, associatedValueColumn, ColumnMapping, PolymorphicUuidAssociation } from "./airtable-entity";
import { ProjectReport, RestorationPartner } from "@terramatch-microservices/database/entities";

const LARAVEL_TYPE_MAPPINGS: Record<string, PolymorphicUuidAssociation<RestorationPartnerAssociations>> = {
  [ProjectReport.LARAVEL_TYPE]: {
    association: "projectReportUuid",
    model: ProjectReport
  }
};

type RestorationPartnerAssociations = {
  projectReportUuid?: string;
};

const COLUMNS: ColumnMapping<RestorationPartner, RestorationPartnerAssociations>[] = [
  "uuid",
  "collection",
  "description",
  associatedValueColumn("projectReportUuid", ["partnerableId", "partnerableType"])
];

export class RestorationPartnerEntity extends AirtableEntity<RestorationPartner, RestorationPartnerAssociations> {
  readonly TABLE_NAME = "Restoration Partners";
  readonly COLUMNS = COLUMNS;
  readonly MODEL = RestorationPartner;
  readonly FILTER_FLAGS = ["hidden"];

  protected async loadAssociations(partners: RestorationPartner[]) {
    return this.loadPolymorphicUuidAssociations(LARAVEL_TYPE_MAPPINGS, "partnerableType", "partnerableId", partners);
  }
}

import { AirtableEntity, associatedValueColumn, ColumnMapping, PolymorphicUuidAssociation } from "./airtable-entity";
import { ProjectReport, SiteReport, Workday } from "@terramatch-microservices/database/entities";

const LARAVEL_TYPE_MAPPINGS: Record<string, PolymorphicUuidAssociation<WorkdayAssociations>> = {
  [ProjectReport.LARAVEL_TYPE]: {
    association: "projectReportUuid",
    model: ProjectReport
  },
  [SiteReport.LARAVEL_TYPE]: {
    association: "siteReportUuid",
    model: SiteReport
  }
};

type WorkdayAssociations = {
  projectReportUuid?: string;
  siteReportUuid?: string;
};

const COLUMNS: ColumnMapping<Workday, WorkdayAssociations>[] = [
  "uuid",
  "collection",
  "description",
  associatedValueColumn("projectReportUuid", ["workdayableId", "workdayableType"]),
  associatedValueColumn("siteReportUuid", ["workdayableId", "workdayableType"])
];

export class WorkdayEntity extends AirtableEntity<Workday, WorkdayAssociations> {
  readonly TABLE_NAME = "Workdays";
  readonly COLUMNS = COLUMNS;
  readonly MODEL = Workday;
  readonly HAS_HIDDEN_FLAG = true;

  protected async loadAssociations(workdays: Workday[]) {
    return this.loadPolymorphicUuidAssociations(LARAVEL_TYPE_MAPPINGS, "workdayableType", "workdayableId", workdays);
  }
}

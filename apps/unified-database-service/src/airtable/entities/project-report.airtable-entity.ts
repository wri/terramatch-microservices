import { ProjectReport } from "@terramatch-microservices/database/entities";
import { AirtableEntity, ColumnMapping, commonEntityColumns } from "./airtable-entity";

const COLUMNS: ColumnMapping<ProjectReport>[] = [...commonEntityColumns("projectReport")];

export class ProjectReportEntity extends AirtableEntity<ProjectReport> {
  readonly TABLE_NAME = "Project Reports";
  readonly COLUMNS = COLUMNS;
  readonly MODEL = ProjectReport;
}

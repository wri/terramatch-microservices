/* istanbul ignore file */
import { AirtableEntity } from "./airtable-entity";
import { Task } from "@terramatch-microservices/database/entities";
import { commonEntityColumns } from "../util/columns";
import { ColumnMapping } from "../util/types";

const COLUMNS: ColumnMapping<Task>[] = [
  ...commonEntityColumns<Task>("task"),
  "status",
  "dueAt",
  {
    airtableColumn: "organisationUuid",
    include: [{ association: "organisation", attributes: ["uuid"] }],
    valueMap: async ({ organisation }) => organisation?.uuid
  },
  {
    airtableColumn: "projectUuid",
    include: [{ association: "project", attributes: ["uuid"] }],
    valueMap: async ({ project }) => project?.uuid
  }
];

export class TaskEntity extends AirtableEntity<Task> {
  readonly TABLE_NAME = "Tasks";
  readonly COLUMNS = COLUMNS;
  readonly MODEL = Task;
}

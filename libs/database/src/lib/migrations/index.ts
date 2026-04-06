import { createTestTable } from "./202604061450-create-test-table";
import { QueryInterface } from "sequelize";
import { RunnableMigration } from "umzug";

export const migrations: RunnableMigration<QueryInterface>[] = [createTestTable];

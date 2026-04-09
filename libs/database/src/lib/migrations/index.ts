import { QueryInterface } from "sequelize";
import { RunnableMigration } from "umzug";
import { removeOrgConsortium } from "./202604071229-remove-org-consortium";

export const migrations: RunnableMigration<QueryInterface>[] = [removeOrgConsortium];

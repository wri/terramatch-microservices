import { QueryInterface } from "sequelize";
import { RunnableMigration } from "umzug";
import { removeOrgConsortium } from "./202604071229-remove-org-consortium";
import { unifyMonetaryDecimal152 } from "./202604081400-unify-monetary-decimal-15-2";
import { revertProjectBudgetColumnsProdTypes } from "./202604151400-revert-project-budget-columns-prod-types";
import { makeAssortedColumnsNullable } from "./202605041703-make-assorted-columns-nullable";
import { tm3300ProjectPolygonHandoff } from "./202605061200-tm-3300-project-polygon-handoff";

export const migrations: RunnableMigration<QueryInterface>[] = [
  removeOrgConsortium,
  unifyMonetaryDecimal152,
  revertProjectBudgetColumnsProdTypes,
  makeAssortedColumnsNullable,
  tm3300ProjectPolygonHandoff
];

import { QueryInterface } from "sequelize";
import { RunnableMigration } from "umzug";
import { removeOrgConsortium } from "./202604071229-remove-org-consortium";
import { unifyMonetaryDecimal152 } from "./202604081400-unify-monetary-decimal-15-2";
import { revertProjectBudgetColumnsProdTypes } from "./202604151400-revert-project-budget-columns-prod-types";
import { makeAssortedColumnsNullable } from "./202605041703-make-assorted-columns-nullable";
import { tm3300ProjectPolygonHandoff } from "./202605061200-tm-3300-project-polygon-handoff";
import { removeUnusedColumns } from "./202605071434-remove-unused-columns";
import { dropUnusedTables } from "./202605130922-drop-unused-tables";
import { convertProjectCohortToSingleSelect } from "./202605291200-convert-project-cohort-to-single-select";
import { addAuditStatusReadColumn } from "./202606071200-add-audit-status-read-column";
import { addProjectSummaryColumn } from "./202606161200-add-project-summary-column";
import { addSitePolygonStatusValidationIndex } from "./202607161200-add-site-polygon-status-validation-index";

export const migrations: RunnableMigration<QueryInterface>[] = [
  removeOrgConsortium,
  unifyMonetaryDecimal152,
  revertProjectBudgetColumnsProdTypes,
  makeAssortedColumnsNullable,
  tm3300ProjectPolygonHandoff,
  removeUnusedColumns,
  dropUnusedTables,
  convertProjectCohortToSingleSelect,
  addAuditStatusReadColumn,
  addProjectSummaryColumn,
  addSitePolygonStatusValidationIndex
];

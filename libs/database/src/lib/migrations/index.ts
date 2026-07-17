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
import { addSitePolygonSubmissionCycle } from "./202607061200-add-site-polygon-submission-cycle";
import { removeDbTriggers } from "./202607071905-remove-db-triggers";
import { addSitePolygonSiteScopedQueryIndex } from "./202607091100-add-site-polygon-site-scoped-query-index";
import { addProjectQaStatusColumns } from "./202607131530-add-project-qa-status-columns";
import { removeFormDeadline } from "./202607141029-remove-form-deadline";
import { updateV2DisturbancesMonetaryDamageField } from "./202607151029-update-v2-disturbances-monetary-damage-field";
import { addAboutSectionTables } from "./202607131426-add-about-section-tables";
import { addCurrencyColumn } from "./202607151300-add-currency-column";
import { addFundoFloraProjectReportBioeconomyFields } from "./202607161500-add-fundo-flora-project-report-bioeconomy-fields";
import { convertBioeconomyReportSelectFieldsToJson } from "./202607171200-convert-bioeconomy-report-select-fields-to-json";
import { convertSitePolygonSubmissionCycleToSingleSelect } from "./202607141100-convert-site-polygon-submission-cycle-to-single-select";

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
  addSitePolygonSubmissionCycle,
  removeDbTriggers,
  addSitePolygonSiteScopedQueryIndex,
  addProjectQaStatusColumns,
  removeFormDeadline,
  addAboutSectionTables,
  updateV2DisturbancesMonetaryDamageField,
  addCurrencyColumn,
  addFundoFloraProjectReportBioeconomyFields,
  convertBioeconomyReportSelectFieldsToJson,
  convertSitePolygonSubmissionCycleToSingleSelect
];

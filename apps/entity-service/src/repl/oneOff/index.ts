// One off scripts for running in the REPL. Should be cleared out occasionally once they've been
// run in all relevant environments.

// To add a new one-off script:
// * Create a script in this directory with the command to run exported
// * Start the script file name with the date that the script was created so we have some sense
//   of how old each script is.
// * Export script in this index file - it will be added to the `oneOff` context member in the REPL,
//   which means it will be runnable in the REPL at > await oneOff.fooScript()

export { migrateRestorationData } from "./2026-02-20-migrateRestorationData";
export { fixTaskStatuses } from "./2026-02-20-fixTaskStatuses";
export { migrateProjectCountry } from "./2026-02-25-migrateProjectCountry";
export { migrateFinancialReports } from "./2026-03-02-migrateFinancialReports";
export { fixSiteReportTrees } from "./2026-03-17-fixSiteReportTrees";
export { cleanupReportAuditLogs } from "./2026-03-17-cleanupReportAuditLogs";
export { fundoFloraFormQuestionOptions } from "./2026-04-06-fundoFloraFormQuestionOptions";
export { migrateNurseryTypeSlugs } from "./2026-04-06-migrateNurseryTypeSlugs";
export { migrateFormQuestionsMonetaryInputType } from "./2026-04-13-migrateFormQuestionsMonetaryInputType";
export { addOptionsListToNewField } from "./2026-04-16-addOptionsListToNewField";
export { updateImageUrls } from "./2026-04-30-updateImageUrls";
export { reportDefaultValues } from "./2026-05-04-reportDefaultValues";
export { dedupeProjectReportDocuments } from "./2026-04-29-dedupeProjectReportDocuments";
export { fixFFAggregateQuestions } from "./2026-05-11-fixFFAggregateQuestions";
export { renameSitePolygonStatuses } from "./2026-05-18-renameSitePolygonStatuses";
export { restoreDeletedProjects } from "./2026-05-20-restoreDeletedProjects";
export { migrateProjectLinkages } from "./2026-05-21-migrateProjectLinkages";
export { importProjectCohortLandscape } from "./2026-05-28-importProjectCohortLandscape";
export { importProjectSummary } from "./2026-06-16-importProjectSummary";
export { importInvestmentSplits } from "./2026-06-17-importInvestmentSplits";
export { reassignVokenelSites } from "./2026-06-17-reassignVokenelSites";
export { fundoFloraFormOptionLabelIds } from "./2026-06-03-fundoFloraFormOptionLabelIds";
export { trackingImport } from "./2026-06-04-trackingImport";
export { updateRequestDataFix } from "./2026-06-23-updateRequestDataFix";
export { useQuestionName } from "./2026-06-25-useQuestionName";
export { importTerraFundProjects, importTerraFundTreeSpecies } from "./2026-07-01-importTerraFundContractData";
export { seedAboutSections } from "./2026-07-13-seedAboutSections";
export { updateDisturbanceReportMonetaryDamageField } from "./2026-07-15-updateDisturbanceReportMonetaryDamagefield";

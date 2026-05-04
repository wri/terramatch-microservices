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

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

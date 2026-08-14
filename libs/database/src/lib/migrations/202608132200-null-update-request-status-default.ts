import { RunnableMigration } from "umzug";
import { QueryInterface, STRING } from "sequelize";

/**
 * Product (TM-3789 follow-up): change_request / update_request_status uses NULL
 * instead of the "no-update" slug. NULL is the default for all entity/report tables.
 *
 * Also reverses 202608131200 which briefly set financial_reports DEFAULT to no-update.
 */
const TABLES = [
  "v2_site_reports",
  "v2_project_reports",
  "v2_nursery_reports",
  "srp_reports",
  "financial_reports",
  "disturbance_reports",
  "v2_projects",
  "v2_sites",
  "v2_nurseries"
] as const;

export const nullUpdateRequestStatusDefault: RunnableMigration<QueryInterface> = {
  name: "202608132200-null-update-request-status-default",

  async up({ context }) {
    for (const table of TABLES) {
      await context.sequelize.query(
        `UPDATE \`${table}\` SET \`update_request_status\` = NULL WHERE \`update_request_status\` = 'no-update'`
      );

      await context.changeColumn(table, "update_request_status", {
        type: STRING,
        allowNull: true,
        defaultValue: null
      });
    }
  },

  async down({ context }) {
    for (const table of TABLES) {
      await context.sequelize.query(
        `UPDATE \`${table}\` SET \`update_request_status\` = 'no-update' WHERE \`update_request_status\` IS NULL`
      );

      await context.changeColumn(table, "update_request_status", {
        type: STRING,
        allowNull: true,
        defaultValue: "no-update"
      });
    }
  }
};

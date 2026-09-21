import { RunnableMigration } from "umzug";
import { DATEONLY, QueryInterface } from "sequelize";

const TIMESTAMP_TABLES = ["financial_reports", "disturbance_reports", "srp_reports"] as const;

export const removeApprovedAtColumns: RunnableMigration<QueryInterface> = {
  name: "202609181210-remove-approved-at-columns",

  async up({ context }) {
    await context.removeColumn("v2_site_reports", "approved_at");
    for (const table of TIMESTAMP_TABLES) {
      await context.removeColumn(table, "approved_at");
    }
  },

  async down({ context }) {
    await context.addColumn("v2_site_reports", "approved_at", {
      type: DATEONLY,
      allowNull: true
    });
    for (const table of TIMESTAMP_TABLES) {
      await context.addColumn(table, "approved_at", {
        type: "TIMESTAMP",
        allowNull: true
      });
    }
  }
};

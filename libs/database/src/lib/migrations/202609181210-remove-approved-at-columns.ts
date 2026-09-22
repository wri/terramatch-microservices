import { RunnableMigration } from "umzug";
import { DATEONLY, QueryInterface } from "sequelize";

const TABLES = ["v2_site_reports", "financial_reports", "disturbance_reports", "srp_reports"] as const;

export const removeApprovedAtColumns: RunnableMigration<QueryInterface> = {
  name: "202609181210-remove-approved-at-columns",

  async up({ context }) {
    // removeColumn() hits a Sequelize + MariaDB driver bug (Cannot delete property 'meta').
    // ALTER TABLE DROP matches the path used by changeColumn, which does not trigger it.
    for (const table of TABLES) {
      await context.sequelize.query(`ALTER TABLE \`${table}\` DROP COLUMN IF EXISTS \`approved_at\``);
    }
  },

  async down({ context }) {
    await context.addColumn("v2_site_reports", "approved_at", {
      type: DATEONLY,
      allowNull: true
    });
    for (const table of ["financial_reports", "disturbance_reports", "srp_reports"] as const) {
      await context.addColumn(table, "approved_at", {
        type: "TIMESTAMP",
        allowNull: true
      });
    }
  }
};

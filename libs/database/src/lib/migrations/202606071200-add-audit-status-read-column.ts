import { RunnableMigration } from "umzug";
import { BOOLEAN, QueryInterface } from "sequelize";

export const addAuditStatusReadColumn: RunnableMigration<QueryInterface> = {
  name: "202606071200-add-audit-status-read-column",

  async up({ context }) {
    await context.addColumn("audit_statuses", "is_read", {
      type: BOOLEAN,
      allowNull: false,
      defaultValue: false
    });
  },

  async down({ context }) {
    await context.removeColumn("audit_statuses", "is_read");
  }
};

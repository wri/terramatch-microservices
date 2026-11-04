import { RunnableMigration } from "umzug";
import { QueryInterface, STRING } from "sequelize";

// These columns were created as varchar(20), which is too short for "terrafund-non-profits".
const COLUMNS = [
  ["frameworks", "slug"],
  ["v2_projects", "framework_key"],
  ["v2_sites", "framework_key"],
  ["v2_nurseries", "framework_key"],
  ["v2_project_reports", "framework_key"],
  ["v2_site_reports", "framework_key"],
  ["v2_nursery_reports", "framework_key"]
] as const;

export const widenFrameworkKeyColumns: RunnableMigration<QueryInterface> = {
  name: "202611041200-widen-framework-key-columns",

  async up({ context }) {
    for (const [table, column] of COLUMNS) {
      await context.changeColumn(table, column, { type: STRING, allowNull: true });
    }
  },

  async down({ context }) {
    for (const [table, column] of COLUMNS) {
      await context.changeColumn(table, column, { type: STRING(20), allowNull: true });
    }
  }
};

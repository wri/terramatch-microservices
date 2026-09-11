import { RunnableMigration } from "umzug";
import { DATE, DATEONLY, QueryInterface } from "sequelize";

const TABLES = [
  "v2_tasks",
  "v2_site_reports",
  "v2_project_reports",
  "financial_reports",
  "v2_nursery_reports",
  "disturbance_reports",
  "srp_reports"
] as const;

export const convertDueAtToDate: RunnableMigration<QueryInterface> = {
  name: "202608242200-convert-due-at-to-date",

  async up({ context }) {
    for (const table of TABLES) {
      await context.changeColumn(table, "due_at", {
        type: DATEONLY,
        allowNull: true
      });
    }
  },

  async down({ context }) {
    for (const table of TABLES) {
      await context.changeColumn(table, "due_at", {
        type: DATE,
        allowNull: true
      });
    }
  }
};

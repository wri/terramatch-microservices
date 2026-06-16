import { RunnableMigration } from "umzug";
import { QueryInterface, TEXT } from "sequelize";

export const addProjectSummaryColumn: RunnableMigration<QueryInterface> = {
  name: "202606161200-add-project-summary-column",

  async up({ context }) {
    await context.addColumn("v2_projects", "project_summary", {
      type: TEXT,
      allowNull: true
    });
  },

  async down({ context }) {
    await context.removeColumn("v2_projects", "project_summary");
  }
};

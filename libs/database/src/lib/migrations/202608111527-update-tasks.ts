import { QueryInterface, STRING } from "sequelize";
import { RunnableMigration } from "umzug";

export const updateTasks: RunnableMigration<QueryInterface> = {
  name: "202608111527-update-tasks",

  async up({ context }) {
    await context.renameColumn("v2_tasks", "title", "summary");
    // First create the column with a default, then retype to avoid the default.
    await context.addColumn("v2_tasks", "category", {
      type: STRING,
      allowNull: false,
      defaultValue: "project-reporting"
    });
    await context.changeColumn("v2_tasks", "category", { type: STRING, allowNull: false });
    await context.removeColumn("v2_tasks", "period_key");
  },

  async down({ context }) {
    await context.renameColumn("v2_tasks", "summary", "title");
    await context.removeColumn("v2_tasks", "category");
    await context.addColumn("v2_tasks", "period_key", { type: STRING, allowNull: true });
  }
};

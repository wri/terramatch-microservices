import { RunnableMigration } from "umzug";
import { QueryInterface, BIGINT, DECIMAL, INTEGER } from "sequelize";

export const revertProjectBudgetColumnsProdTypes: RunnableMigration<QueryInterface> = {
  name: "202604151400-revert-project-budget-columns-prod-types",

  async up({ context }) {
    await context.changeColumn("project_pitches", "project_budget", {
      type: BIGINT.UNSIGNED,
      allowNull: true
    });

    await context.changeColumn("v2_projects", "budget", {
      type: INTEGER.UNSIGNED,
      allowNull: true
    });
  },

  async down({ context }) {
    await context.changeColumn("v2_projects", "budget", {
      type: DECIMAL(15, 2),
      allowNull: true
    });

    await context.changeColumn("project_pitches", "project_budget", {
      type: DECIMAL(15, 2),
      allowNull: true
    });
  }
};

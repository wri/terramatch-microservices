import { RunnableMigration } from "umzug";
import { QueryInterface, TEXT } from "sequelize";

export const addPitchIncomeGeneratingActivities: RunnableMigration<QueryInterface> = {
  name: "202611031200-add-pitch-income-generating-activities",

  async up({ context }) {
    await context.addColumn("project_pitches", "income_generating_activities", { type: TEXT, allowNull: true });
  },

  async down({ context }) {
    // removeColumn() hits a Sequelize + MariaDB driver bug (Cannot delete property 'meta').
    await context.sequelize.query("ALTER TABLE `project_pitches` DROP COLUMN IF EXISTS `income_generating_activities`");
  }
};

import { RunnableMigration } from "umzug";
import { QueryInterface, TEXT } from "sequelize";

export const addOrganisationAnswers: RunnableMigration<QueryInterface> = {
  name: "202611121200-add-organisation-answers",

  async up({ context }) {
    await context.addColumn("organisations", "answers", { type: TEXT("long"), allowNull: true });
  },

  async down({ context }) {
    // removeColumn() hits a Sequelize + MariaDB driver bug (Cannot delete property 'meta').
    await context.sequelize.query("ALTER TABLE `organisations` DROP COLUMN IF EXISTS `answers`");
  }
};

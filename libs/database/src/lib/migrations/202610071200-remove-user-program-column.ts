import { RunnableMigration } from "umzug";
import { QueryInterface, STRING } from "sequelize";

export const removeUserProgramColumn: RunnableMigration<QueryInterface> = {
  name: "202610071200-remove-user-program-column",

  async up({ context }) {
    // removeColumn() hits a Sequelize + MariaDB driver bug (Cannot delete property 'meta').
    await context.sequelize.query("ALTER TABLE `users` DROP COLUMN IF EXISTS `program`");
  },

  async down({ context }) {
    await context.addColumn("users", "program", { type: STRING, allowNull: true });
  }
};

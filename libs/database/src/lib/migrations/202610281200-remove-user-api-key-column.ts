import { RunnableMigration } from "umzug";
import { QueryInterface, STRING } from "sequelize";

export const removeUserApiKeyColumn: RunnableMigration<QueryInterface> = {
  name: "202610281200-remove-user-api-key-column",

  async up({ context }) {
    // removeColumn() hits a Sequelize + MariaDB driver bug (Cannot delete property 'meta').
    await context.sequelize.query("ALTER TABLE `users` DROP COLUMN IF EXISTS `api_key`");
  },

  async down({ context }) {
    await context.addColumn("users", "api_key", { type: STRING, allowNull: true });
  }
};

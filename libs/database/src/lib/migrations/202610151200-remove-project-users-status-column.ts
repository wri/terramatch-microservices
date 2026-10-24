import { RunnableMigration } from "umzug";
import { QueryInterface, STRING } from "sequelize";

export const removeProjectUsersStatusColumn: RunnableMigration<QueryInterface> = {
  name: "202610151200-remove-project-users-status-column",

  async up({ context }) {
    // removeColumn() hits a Sequelize + MariaDB driver bug (Cannot delete property 'meta').
    await context.sequelize.query("ALTER TABLE `v2_project_users` DROP COLUMN IF EXISTS `status`");
  },

  async down({ context }) {
    await context.addColumn("v2_project_users", "status", { type: STRING, allowNull: true });
  }
};

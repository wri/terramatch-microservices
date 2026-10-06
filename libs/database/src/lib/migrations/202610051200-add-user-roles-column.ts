import { RunnableMigration } from "umzug";
import { QueryInterface } from "sequelize";

export const addUserRolesColumn: RunnableMigration<QueryInterface> = {
  name: "202610051200-add-user-roles-column",

  async up({ context }) {
    // Raw SQL because Sequelize never emits a DEFAULT clause for JSON columns in MariaDB, which
    // would leave existing rows with an empty (invalid JSON) string.
    await context.sequelize.query("ALTER TABLE users ADD COLUMN roles JSON NOT NULL DEFAULT '[]'");
  },

  async down({ context }) {
    await context.removeColumn("users", "roles");
  }
};

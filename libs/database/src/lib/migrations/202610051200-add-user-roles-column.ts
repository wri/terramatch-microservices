import { RunnableMigration } from "umzug";
import { JSON, QueryInterface } from "sequelize";

export const addUserRolesColumn: RunnableMigration<QueryInterface> = {
  name: "202610051200-add-user-roles-column",

  async up({ context }) {
    await context.addColumn("users", "roles", {
      type: JSON,
      allowNull: true
    });
  },

  async down({ context }) {
    await context.removeColumn("users", "roles");
  }
};

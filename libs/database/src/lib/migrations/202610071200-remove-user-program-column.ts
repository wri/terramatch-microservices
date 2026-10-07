import { RunnableMigration } from "umzug";
import { QueryInterface, STRING } from "sequelize";

export const removeUserProgramColumn: RunnableMigration<QueryInterface> = {
  name: "202610071200-remove-user-program-column",

  async up({ context }) {
    await context.removeColumn("users", "program");
  },

  async down({ context }) {
    await context.addColumn("users", "program", { type: STRING, allowNull: true });
  }
};

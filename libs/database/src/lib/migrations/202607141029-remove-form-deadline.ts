import { RunnableMigration } from "umzug";
import { DATE, QueryInterface } from "sequelize";

export const removeFormDeadline: RunnableMigration<QueryInterface> = {
  name: "202607141029-remove-form-deadline",

  async up({ context }) {
    await context.removeColumn("forms", "deadline_at");
  },

  async down({ context }) {
    await context.addColumn("forms", "deadline_at", {
      type: DATE,
      allowNull: true
    });
  }
};

import { RunnableMigration } from "umzug";
import { DATE, QueryInterface } from "sequelize";

export const removeFormDeadline: RunnableMigration<QueryInterface> = {
  name: "202607141029-remove-form-deadline",

  async up({ context }) {
    await context.removeColumn("forms", "deadlineAt");
  },

  async down({ context }) {
    await context.addColumn("forms", "deadlineAt", {
      type: DATE,
      allowNull: true
    });
  }
};

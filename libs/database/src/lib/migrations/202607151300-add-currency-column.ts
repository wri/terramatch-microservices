import { RunnableMigration } from "umzug";
import { QueryInterface, TEXT } from "sequelize";

export const addCurrencyColumn: RunnableMigration<QueryInterface> = {
  name: "202607151300-add-currency-column",

  async up({ context }) {
    await context.addColumn("disturbance_reports", "currency", {
      type: TEXT,
      allowNull: true
    });
  },

  async down({ context }) {
    await context.removeColumn("disturbance_reports", "currency");
  }
};

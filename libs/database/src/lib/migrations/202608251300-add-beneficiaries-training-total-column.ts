import { RunnableMigration } from "umzug";
import { INTEGER, QueryInterface } from "sequelize";

export const addBeneficiariesTrainingTotalColumn: RunnableMigration<QueryInterface> = {
  name: "202608251300-add-beneficiaries-training-total-column",

  async up({ context }) {
    await context.addColumn("v2_project_reports", "beneficiaries_training_total", {
      type: INTEGER.UNSIGNED,
      allowNull: true
    });
  },

  async down({ context }) {
    await context.removeColumn("v2_project_reports", "beneficiaries_training_total");
  }
};

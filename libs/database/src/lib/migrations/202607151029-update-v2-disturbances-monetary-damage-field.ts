import { RunnableMigration } from "umzug";
import { QueryInterface } from "sequelize";

export const updateV2DisturbancesMonetaryDamageField: RunnableMigration<QueryInterface> = {
  name: "202607151029-update-v2-disturbances-monetary-damage-field",

  async up({ context }) {
    await context.renameColumn("v2_disturbances", "monetary_damage", "financial_loss");
  },

  async down({ context }) {
    await context.renameColumn("v2_disturbances", "financial_loss", "monetary_damage");
  }
};

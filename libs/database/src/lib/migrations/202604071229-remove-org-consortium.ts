import { RunnableMigration } from "umzug";
import { QueryInterface, TEXT } from "sequelize";

export const removeOrgConsortium: RunnableMigration<QueryInterface> = {
  name: "202604071229-remove-org-consortium",

  async up({ context }) {
    await context.removeColumn("organisations", "consortium");
  },

  async down({ context }) {
    await context.addColumn("organisations", "consortium", {
      type: TEXT,
      allowNull: true
    });
  }
};

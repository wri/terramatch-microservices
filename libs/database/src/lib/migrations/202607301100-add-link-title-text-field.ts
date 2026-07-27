import { RunnableMigration } from "umzug";
import { QueryInterface, TEXT } from "sequelize";

export const addLinkTitleTextField: RunnableMigration<QueryInterface> = {
  name: "202607301100-add-link-title-text-field",

  async up({ context }) {
    await context.addColumn("links", "title", {
      type: TEXT,
      allowNull: true
    });
  },

  async down({ context }) {
    await context.removeColumn("links", "title");
  }
};

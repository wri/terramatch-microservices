import { RunnableMigration } from "umzug";
import { QueryInterface, TEXT } from "sequelize";

const ABOUT_SECTION_TEXT_COLUMNS = [
  "header",
  "title",
  "description",
  "contact_support_message",
  "contact_support_subject"
] as const;

export const addAboutSectionTextFields: RunnableMigration<QueryInterface> = {
  name: "202607301000-add-about-section-text-fields",

  async up({ context }) {
    for (const column of ABOUT_SECTION_TEXT_COLUMNS) {
      await context.addColumn("about_sections", column, {
        type: TEXT,
        allowNull: true
      });
    }
  },

  async down({ context }) {
    for (const column of ABOUT_SECTION_TEXT_COLUMNS) {
      await context.removeColumn("about_sections", column);
    }
  }
};

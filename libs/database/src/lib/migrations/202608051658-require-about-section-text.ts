import { BIGINT, QueryInterface, TEXT } from "sequelize";
import { RunnableMigration } from "umzug";

export const requireAboutSectionText: RunnableMigration<QueryInterface> = {
  name: "202608051658-require-about-section-text",

  async up({ context }) {
    await context.changeColumn("about_sections", "header", { type: TEXT, allowNull: false });
    await context.changeColumn("about_sections", "description", { type: TEXT, allowNull: false });
    await context.changeColumn("about_sections", "contact_support_message", { type: TEXT, allowNull: false });
    await context.changeColumn("about_sections", "contact_support_subject", { type: TEXT, allowNull: false });
    await context.changeColumn("links", "title", { type: TEXT, allowNull: false });

    // make the i18n ids nullable since they're no longer in use and the creation code in the service
    // is cleaner if it doesn't have to supply them. They'll be removed entirely in another ticket soon
    await context.changeColumn("about_sections", "header_id", { type: BIGINT.UNSIGNED, allowNull: true });
    await context.changeColumn("about_sections", "description_id", { type: BIGINT.UNSIGNED, allowNull: true });
    await context.changeColumn("about_sections", "contact_support_message_id", {
      type: BIGINT.UNSIGNED,
      allowNull: true
    });
    await context.changeColumn("about_sections", "contact_support_subject_id", {
      type: BIGINT.UNSIGNED,
      allowNull: true
    });
    await context.changeColumn("links", "title_id", { type: BIGINT.UNSIGNED, allowNull: true });
  },

  async down({ context }) {
    await context.changeColumn("about_sections", "header", { type: TEXT, allowNull: true });
    await context.changeColumn("about_sections", "description", { type: TEXT, allowNull: true });
    await context.changeColumn("about_sections", "contact_support_message", { type: TEXT, allowNull: true });
    await context.changeColumn("about_sections", "contact_support_subject", { type: TEXT, allowNull: true });
    await context.changeColumn("links", "title", { type: TEXT, allowNull: true });

    await context.changeColumn("about_sections", "header_id", { type: BIGINT.UNSIGNED, allowNull: false });
    await context.changeColumn("about_sections", "description_id", { type: BIGINT.UNSIGNED, allowNull: false });
    await context.changeColumn("about_sections", "contact_support_message_id", {
      type: BIGINT.UNSIGNED,
      allowNull: false
    });
    await context.changeColumn("about_sections", "contact_support_subject_id", {
      type: BIGINT.UNSIGNED,
      allowNull: false
    });
    await context.changeColumn("links", "title_id", { type: BIGINT.UNSIGNED, allowNull: false });
  }
};

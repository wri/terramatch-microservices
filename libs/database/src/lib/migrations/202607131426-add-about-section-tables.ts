import { BIGINT, QueryInterface, JSON, STRING, DATE } from "sequelize";
import { RunnableMigration } from "umzug";

export const addAboutSectionTables: RunnableMigration<QueryInterface> = {
  name: "202607131426-add-about-section-tables",

  async up({ context }) {
    const transaction = await context.sequelize.transaction();

    try {
      await context.createTable(
        "about_sections",
        {
          id: { type: BIGINT.UNSIGNED, allowNull: false, primaryKey: true, autoIncrement: true },
          created_at: { type: DATE, allowNull: true },
          updated_at: { type: DATE, allowNull: true },
          deleted_at: { type: DATE, allowNull: true },
          type: { type: STRING, allowNull: false },
          frameworks: { type: JSON, allowNull: true },
          header_id: { type: BIGINT.UNSIGNED, allowNull: false },
          title_id: { type: BIGINT.UNSIGNED, allowNull: true },
          description_id: { type: BIGINT.UNSIGNED, allowNull: false },
          contact_support_message_id: { type: BIGINT.UNSIGNED, allowNull: false },
          contact_support_subject_id: { type: BIGINT.UNSIGNED, allowNull: false }
        },
        { transaction }
      );

      await context.createTable(
        "links",
        {
          id: { type: BIGINT.UNSIGNED, allowNull: false, primaryKey: true, autoIncrement: true },
          created_at: { type: DATE, allowNull: true },
          updated_at: { type: DATE, allowNull: true },
          deleted_at: { type: DATE, allowNull: true },
          title_id: { type: BIGINT.UNSIGNED, allowNull: false },
          url: { type: STRING, allowNull: false },
          linkable_type: { type: STRING, allowNull: false },
          linkable_id: { type: BIGINT.UNSIGNED, allowNull: false }
        },
        { transaction }
      );

      await context.addIndex("links", ["linkable_type", "linkable_id"], {
        name: "link_type_id",
        unique: false,
        transaction
      });

      await transaction.commit();
    } catch (e) {
      console.error("Error creating tables", e);
      await transaction.rollback();
      throw e;
    }
  },

  async down({ context }) {
    await context.dropTable("about_sections");
    await context.dropTable("links");
  }
};

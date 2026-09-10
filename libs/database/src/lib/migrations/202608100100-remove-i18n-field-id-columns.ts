import { BIGINT, INTEGER, QueryInterface } from "sequelize";
import { RunnableMigration } from "umzug";

/**
 * Drops remaining legacy `*_id` i18n lookup columns for Forms, AboutSection, Link, and
 * FundingProgramme. LocalizationKey.value_id is kept.
 */
const COLUMNS: { table: string; columns: string[]; type: typeof BIGINT.UNSIGNED | typeof INTEGER }[] = [
  {
    table: "about_sections",
    columns: ["header_id", "title_id", "description_id", "contact_support_message_id", "contact_support_subject_id"],
    type: BIGINT.UNSIGNED
  },
  {
    table: "links",
    columns: ["title_id"],
    type: BIGINT.UNSIGNED
  },
  {
    table: "funding_programmes",
    columns: ["name_id", "description_id"],
    type: INTEGER
  },
  {
    table: "forms",
    columns: ["title_id", "subtitle_id", "description_id", "submission_message_id"],
    type: INTEGER
  },
  {
    table: "form_sections",
    columns: ["title_id", "subtitle_id", "description_id"],
    type: INTEGER
  },
  {
    table: "form_questions",
    columns: ["label_id", "description_id", "placeholder_id"],
    type: INTEGER
  },
  {
    table: "form_question_options",
    columns: ["label_id"],
    type: INTEGER
  },
  {
    table: "form_table_headers",
    columns: ["label_id"],
    type: INTEGER
  },
  {
    table: "form_option_list_options",
    columns: ["label_id"],
    type: INTEGER
  },
  {
    table: "funding_programmes",
    columns: ["location_id"],
    type: INTEGER
  }
];

export const removeI18nFieldIdColumns: RunnableMigration<QueryInterface> = {
  name: "202608100100-remove-i18n-field-id-columns",

  async up({ context }) {
    for (const { table, columns } of COLUMNS) {
      for (const column of columns) {
        await context.removeColumn(table, column);
      }
    }
  },

  async down({ context }) {
    for (const { table, columns, type } of COLUMNS) {
      for (const column of columns) {
        await context.addColumn(table, column, {
          type,
          allowNull: true
        });
      }
    }
  }
};

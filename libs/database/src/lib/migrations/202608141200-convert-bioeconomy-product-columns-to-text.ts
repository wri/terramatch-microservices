import { RunnableMigration } from "umzug";
import { JSON as JSON_TYPE, QueryInterface, TEXT } from "sequelize";

const TABLE = "v2_project_reports";
const COLUMNS = ["bioeconomy_product_sold", "bioeconomy_product_benefit"] as const;

export const convertBioeconomyProductColumnsToText: RunnableMigration<QueryInterface> = {
  name: "202608141200-convert-bioeconomy-product-columns-to-text",

  async up({ context }) {
    for (const column of COLUMNS) {
      await context.sequelize.query(`UPDATE \`${TABLE}\` SET \`${column}\` = NULL`);
      await context.changeColumn(TABLE, column, {
        type: TEXT,
        allowNull: true
      });
    }
  },

  async down({ context }) {
    for (const column of COLUMNS) {
      await context.changeColumn(TABLE, column, {
        type: JSON_TYPE,
        allowNull: true
      });
    }
  }
};

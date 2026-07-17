import { RunnableMigration } from "umzug";
import { JSON as JSON_TYPE, QueryInterface, TEXT } from "sequelize";

const BIOECONOMY_MULTI_SELECT_COLUMNS = [
  "bioeconomy_product_list",
  "bioeconomy_product_benefit",
  "bioeconomy_product_sold",
  "bioeconomy_quality_certifications",
  "bioeconomy_buyers"
] as const;

const wrapScalarAsJsonArray = (column: string) => `
UPDATE v2_project_reports
SET ${column} = JSON_ARRAY(${column})
WHERE ${column} IS NOT NULL
  AND ${column} != ''
  AND JSON_TYPE(${column}) = 'STRING';
`;

const unwrapJsonArrayToScalar = (column: string) => `
UPDATE v2_project_reports
SET ${column} = JSON_UNQUOTE(JSON_EXTRACT(${column}, '$[0]'))
WHERE ${column} IS NOT NULL
  AND JSON_TYPE(${column}) = 'ARRAY'
  AND JSON_LENGTH(${column}) > 0;
`;

export const convertBioeconomyReportSelectFieldsToJson: RunnableMigration<QueryInterface> = {
  name: "202607171200-convert-bioeconomy-report-select-fields-to-json",

  async up({ context }) {
    for (const column of BIOECONOMY_MULTI_SELECT_COLUMNS) {
      await context.sequelize.query(wrapScalarAsJsonArray(column));
      await context.changeColumn("v2_project_reports", column, {
        type: JSON_TYPE,
        allowNull: true
      });
    }
  },

  async down({ context }) {
    for (const column of BIOECONOMY_MULTI_SELECT_COLUMNS) {
      await context.changeColumn("v2_project_reports", column, {
        type: TEXT,
        allowNull: true
      });
      await context.sequelize.query(unwrapJsonArrayToScalar(column));
    }
  }
};

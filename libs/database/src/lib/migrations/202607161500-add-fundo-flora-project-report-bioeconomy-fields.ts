import { RunnableMigration } from "umzug";
import { JSON as JSON_TYPE, QueryInterface, TEXT } from "sequelize";

const BIOECONOMY_MULTI_SELECT_COLUMNS = [
  "bioeconomy_product_list",
  "bioeconomy_product_benefit",
  "bioeconomy_product_sold",
  "bioeconomy_quality_certifications",
  "bioeconomy_buyers"
] as const;

export const addFundoFloraProjectReportBioeconomyFields: RunnableMigration<QueryInterface> = {
  name: "202607161500-add-fundo-flora-project-report-bioeconomy-fields",

  async up({ context }) {
    for (const column of BIOECONOMY_MULTI_SELECT_COLUMNS) {
      await context.addColumn("v2_project_reports", column, {
        type: JSON_TYPE,
        allowNull: true
      });
    }

    for (const column of ["bioeconomy_other_certifications", "women_governance"]) {
      await context.addColumn("v2_project_reports", column, {
        type: TEXT,
        allowNull: true
      });
    }
  },

  async down({ context }) {
    for (const column of [...BIOECONOMY_MULTI_SELECT_COLUMNS, "bioeconomy_other_certifications", "women_governance"]) {
      await context.removeColumn("v2_project_reports", column);
    }
  }
};

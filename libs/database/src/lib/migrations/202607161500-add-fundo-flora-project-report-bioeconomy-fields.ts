import { RunnableMigration } from "umzug";
import { QueryInterface, TEXT } from "sequelize";

export const addFundoFloraProjectReportBioeconomyFields: RunnableMigration<QueryInterface> = {
  name: "202607161500-add-fundo-flora-project-report-bioeconomy-fields",

  async up({ context }) {
    for (const column of [
      "bioeconomy_product_list",
      "bioeconomy_product_benefit",
      "bioeconomy_product_sold",
      "bioeconomy_quality_certifications",
      "bioeconomy_other_certifications",
      "bioeconomy_buyers",
      "women_governance"
    ]) {
      await context.addColumn("v2_project_reports", column, {
        type: TEXT,
        allowNull: true
      });
    }
  },

  async down({ context }) {
    for (const column of [
      "bioeconomy_product_list",
      "bioeconomy_product_benefit",
      "bioeconomy_product_sold",
      "bioeconomy_quality_certifications",
      "bioeconomy_other_certifications",
      "bioeconomy_buyers",
      "women_governance"
    ]) {
      await context.removeColumn("v2_project_reports", column);
    }
  }
};

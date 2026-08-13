import { RunnableMigration } from "umzug";
import { QueryInterface, STRING } from "sequelize";

/**
 * financial_reports.update_request_status was created nullable with DEFAULT NULL.
 * Align with v2_project_reports / v2_nursery_reports / v2_site_reports (DEFAULT 'no-update')
 * so new financial reports get no-update without relying on application code.
 */
export const defaultFinancialReportsUpdateRequestStatus: RunnableMigration<QueryInterface> = {
  name: "202608131200-default-financial-reports-update-request-status",

  async up({ context }) {
    await context.sequelize.query(
      `UPDATE financial_reports SET update_request_status = 'no-update' WHERE update_request_status IS NULL`
    );

    await context.changeColumn("financial_reports", "update_request_status", {
      type: STRING,
      allowNull: true,
      defaultValue: "no-update"
    });
  },

  async down({ context }) {
    await context.changeColumn("financial_reports", "update_request_status", {
      type: STRING,
      allowNull: true,
      defaultValue: null
    });
  }
};

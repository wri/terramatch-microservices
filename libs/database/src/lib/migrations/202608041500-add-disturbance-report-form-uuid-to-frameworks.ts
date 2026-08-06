import { RunnableMigration } from "umzug";
import { QueryInterface, UUID } from "sequelize";

export const addDisturbanceReportFormUuidToFrameworks: RunnableMigration<QueryInterface> = {
  name: "202608041500-add-disturbance-report-form-uuid-to-frameworks",

  async up({ context }) {
    await context.addColumn("frameworks", "disturbance_report_form_uuid", {
      type: UUID,
      allowNull: true
    });
  },

  async down({ context }) {
    await context.removeColumn("frameworks", "disturbance_report_form_uuid");
  }
};

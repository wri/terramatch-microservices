import { RunnableMigration } from "umzug";
import { BOOLEAN, QueryInterface, STRING } from "sequelize";
import { POLYGON_DATA_SUBMISSION_DEFAULT } from "../constants/polygon-data-submission";

export const tm3300ProjectPolygonHandoff: RunnableMigration<QueryInterface> = {
  name: "202605061200-tm-3300-project-polygon-handoff",

  async up({ context }) {
    await context.addColumn("v2_projects", "polygon_data_submission", {
      type: STRING(64),
      allowNull: false,
      defaultValue: POLYGON_DATA_SUBMISSION_DEFAULT
    });
    await context.addColumn("v2_projects", "ready_for_baseline", {
      type: BOOLEAN,
      allowNull: false,
      defaultValue: false
    });
  },

  async down({ context }) {
    await context.removeColumn("v2_projects", "ready_for_baseline");
    await context.removeColumn("v2_projects", "polygon_data_submission");
  }
};

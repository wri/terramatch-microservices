import { RunnableMigration } from "umzug";
import { JSON, QueryInterface } from "sequelize";

export const addSitePolygonSubmissionCycle: RunnableMigration<QueryInterface> = {
  name: "202607061200-add-site-polygon-submission-cycle",

  async up({ context }) {
    await context.addColumn("site_polygon", "submission_cycle", {
      type: JSON,
      allowNull: true
    });
  },

  async down({ context }) {
    await context.removeColumn("site_polygon", "submission_cycle");
  }
};

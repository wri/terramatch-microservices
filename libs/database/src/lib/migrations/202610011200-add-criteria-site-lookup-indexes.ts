import { QueryInterface } from "sequelize";
import { RunnableMigration } from "umzug";

export const addCriteriaSiteLookupIndexes: RunnableMigration<QueryInterface> = {
  name: "202610011200-add-criteria-site-lookup-indexes",

  async up({ context }) {
    await context.addIndex("criteria_site", ["polygon_id"], { name: "criteria_site_polygon_id_index" });
    await context.addIndex("criteria_site", ["criteria_id"], { name: "criteria_site_criteria_id_index" });
    await context.addIndex("criteria_site_historic", ["polygon_id"], {
      name: "criteria_site_historic_polygon_id_index"
    });
    await context.addIndex("criteria_site_historic", ["criteria_id"], {
      name: "criteria_site_historic_criteria_id_index"
    });
  },

  async down({ context }) {
    await context.removeIndex("criteria_site_historic", "criteria_site_historic_criteria_id_index");
    await context.removeIndex("criteria_site_historic", "criteria_site_historic_polygon_id_index");
    await context.removeIndex("criteria_site", "criteria_site_criteria_id_index");
    await context.removeIndex("criteria_site", "criteria_site_polygon_id_index");
  }
};

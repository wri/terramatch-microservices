import { RunnableMigration } from "umzug";
import { QueryInterface } from "sequelize";

// Speeds up "does this polygon have an OVERLAPPING (criteria 3) failure?" lookups, which the site
// review rollup does per polygon (EXISTS on criteria_site by polygon_id + criteria_id + valid) and
// the OVERLAPPING validator does constantly. Without it, criteria_site (hundreds of thousands of
// rows) is scanned per polygon — catastrophic for large sites; with it each check is one index seek.
const INDEX_NAME = "idx_criteria_site_criteria_valid_polygon";

export const addCriteriaSiteOverlapLookupIndex: RunnableMigration<QueryInterface> = {
  name: "202609071600-add-criteria-site-overlap-lookup-index",

  async up({ context }) {
    await context.addIndex("criteria_site", ["criteria_id", "valid", "polygon_id"], {
      name: INDEX_NAME
    });
  },

  async down({ context }) {
    await context.removeIndex("criteria_site", INDEX_NAME);
  }
};

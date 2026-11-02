import { RunnableMigration } from "umzug";
import { QueryInterface } from "sequelize";

const OLD_INDEX_NAME = "idx_site_polygon_site_id_is_active_deleted_at";
const NEW_INDEX_NAME = "idx_site_polygon_site_id_is_active_deleted_at_aggregates";
const SITE_SCOPED_COLUMNS = ["site_id", "is_active", "deleted_at"];

export const extendSitePolygonSiteScopedQueryIndex: RunnableMigration<QueryInterface> = {
  name: "202610221200-extend-site-polygon-site-scoped-query-index",

  async up({ context }) {
    await context.addIndex("site_polygon", [...SITE_SCOPED_COLUMNS, "num_trees", "calc_area"], {
      name: NEW_INDEX_NAME
    });
    await context.removeIndex("site_polygon", OLD_INDEX_NAME);
  },

  async down({ context }) {
    await context.addIndex("site_polygon", SITE_SCOPED_COLUMNS, { name: OLD_INDEX_NAME });
    await context.removeIndex("site_polygon", NEW_INDEX_NAME);
  }
};

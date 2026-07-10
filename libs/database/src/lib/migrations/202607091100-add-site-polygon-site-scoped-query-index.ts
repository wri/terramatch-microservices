import { RunnableMigration } from "umzug";
import { QueryInterface } from "sequelize";

const INDEX_NAME = "idx_site_polygon_site_id_is_active_deleted_at";

export const addSitePolygonSiteScopedQueryIndex: RunnableMigration<QueryInterface> = {
  name: "202607091100-add-site-polygon-site-scoped-query-index",

  async up({ context }) {
    await context.addIndex("site_polygon", ["site_id", "is_active", "deleted_at"], {
      name: INDEX_NAME
    });
  },

  async down({ context }) {
    await context.removeIndex("site_polygon", INDEX_NAME);
  }
};

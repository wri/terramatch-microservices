import { QueryInterface } from "sequelize";
import { RunnableMigration } from "umzug";

/**
 * The polygon-explorer map (and other consumers of the sitePolygons index) commonly filter
 * `site_polygon` by `is_active` / `deleted_at` (applied to virtually every query on this table) combined
 * with `status` and `validation_status` (no dedicated index previously existed for `validation_status`,
 * nor for the combination of all four). This composite index lets that filter combination resolve as a
 * single index range scan instead of relying on a single-column index plus a filesort/table scan.
 */
export const addSitePolygonStatusValidationIndex: RunnableMigration<QueryInterface> = {
  name: "202607161200-add-site-polygon-status-validation-index",

  async up({ context }) {
    await context.addIndex("site_polygon", ["is_active", "deleted_at", "status", "validation_status"], {
      name: "idx_site_polygon_active_status_validation"
    });
  },

  async down({ context }) {
    await context.removeIndex("site_polygon", "idx_site_polygon_active_status_validation");
  }
};

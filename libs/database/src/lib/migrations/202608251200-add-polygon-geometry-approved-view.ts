import { RunnableMigration } from "umzug";
import { QueryInterface } from "sequelize";

const APPROVED_VIEW_SQL = `
CREATE OR REPLACE ALGORITHM = MERGE SQL SECURITY INVOKER VIEW polygon_geometry_approved AS
SELECT
  pg.uuid AS uuid,
  pg.geom AS geom
FROM polygon_geometry pg
INNER JOIN site_polygon sp
  ON sp.poly_id = pg.uuid
WHERE sp.is_active = 1
  AND sp.status = 'approved'
  AND sp.deleted_at IS NULL
  AND pg.deleted_at IS NULL
`.trim();

export const addPolygonGeometryApprovedView: RunnableMigration<QueryInterface> = {
  name: "202608251200-add-polygon-geometry-approved-view",

  async up({ context }) {
    await context.sequelize.query(APPROVED_VIEW_SQL);
  },

  async down({ context }) {
    await context.sequelize.query("DROP VIEW IF EXISTS polygon_geometry_approved");
  }
};

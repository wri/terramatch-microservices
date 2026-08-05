import { RunnableMigration } from "umzug";
import { QueryInterface } from "sequelize";

const POLY_ID_INDEX = "idx_site_polygon_poly_id";
const POLY_ID_ACTIVE_DELETED_INDEX = "idx_site_polygon_poly_id_is_active_deleted_at";

const ACTIVE_VIEW_SQL = `
CREATE OR REPLACE ALGORITHM = MERGE SQL SECURITY INVOKER VIEW polygon_geometry_active AS
SELECT
  pg.uuid AS uuid,
  pg.geom AS geom
FROM polygon_geometry pg
INNER JOIN site_polygon sp
  ON sp.poly_id = pg.uuid
WHERE sp.is_active = 1
  AND sp.deleted_at IS NULL
  AND pg.deleted_at IS NULL
`.trim();

const DELETED_VIEW_SQL = `
CREATE OR REPLACE ALGORITHM = MERGE SQL SECURITY INVOKER VIEW polygon_geometry_deleted AS
SELECT
  pg.uuid AS uuid,
  pg.geom AS geom
FROM polygon_geometry pg
INNER JOIN site_polygon sp
  ON sp.poly_id = pg.uuid
WHERE sp.is_active = 1
  AND sp.deleted_at IS NOT NULL
`.trim();

export const addPolygonGeometryActiveDeletedViews: RunnableMigration<QueryInterface> = {
  name: "202608051200-add-polygon-geometry-active-deleted-views",

  async up({ context }) {
    await context.removeIndex("site_polygon", POLY_ID_INDEX);
    await context.addIndex("site_polygon", ["poly_id", "is_active", "deleted_at"], {
      name: POLY_ID_ACTIVE_DELETED_INDEX
    });

    await context.sequelize.query(ACTIVE_VIEW_SQL);
    await context.sequelize.query(DELETED_VIEW_SQL);
  },

  async down({ context }) {
    await context.sequelize.query("DROP VIEW IF EXISTS polygon_geometry_deleted");
    await context.sequelize.query("DROP VIEW IF EXISTS polygon_geometry_active");

    await context.removeIndex("site_polygon", POLY_ID_ACTIVE_DELETED_INDEX);
    await context.addIndex("site_polygon", ["poly_id"], {
      name: POLY_ID_INDEX
    });
  }
};

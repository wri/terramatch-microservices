#!/usr/bin/env python
# /// script
# requires-python = ">=3.10"
# dependencies = [
#   "duckdb>=1.1.0",
# ]
# ///
"""
parquet_dump.py — GeoParquet edition
=============================================
Runs a spatial query via DuckDB (mysql + spatial extensions), and writes GeoParquet output.

Usage:
    uv run parquet_dump.py
"""
from __future__ import annotations

import argparse
import pathlib
import subprocess
import time
import uuid

# ---------------------------------------------------------------------------
# DuckDB export
# ---------------------------------------------------------------------------

POLYGONS_QUERY = """\
SELECT vp.uuid as project_id, vp.name as project_name, vp.country,
       vp.framework_key, vp.short_name, CAST(vp.cohort AS CHAR) AS cohort,
       vp.polygon_data_submission, vp.ready_for_baseline,
       vs.name as site_name, vs.uuid as site_id,
       sp.poly_name, sp.uuid as poly_uuid, sp.plantstart, sp.practice,
       sp.target_sys, sp.distr, sp.calc_area,
       sp.status, sp.version_name, sp.is_active,
       sp.source, sp.deleted_at,
       HEX(ST_AsBinary(pg.geom)) as geom
FROM v2_sites vs
INNER JOIN v2_projects vp ON vp.id = vs.project_id
INNER JOIN site_polygon sp ON sp.site_id = vs.uuid
INNER JOIN polygon_geometry pg ON pg.uuid = sp.poly_id
WHERE sp.status = 'approved' AND sp.is_active = 1
      AND sp.deleted_at IS NULL AND sp.plantstart IS NOT NULL
ORDER BY vp.short_name, vs.name, sp.poly_name\
"""

TREE_COVER_QUERY = """\
SELECT sp.uuid AS poly_uuid, tc.year_of_analysis, tc.percent_cover, tc.project_phase
FROM indicator_output_tree_cover tc
INNER JOIN site_polygon sp ON sp.id = tc.site_polygon_id
WHERE tc.deleted_at IS NULL\
"""

TREE_COUNT_QUERY = """\
SELECT sp.uuid AS poly_uuid, tcnt.year_of_analysis, tcnt.tree_count
FROM indicator_output_tree_count tcnt
INNER JOIN site_polygon sp ON sp.id = tcnt.site_polygon_id
WHERE tcnt.deleted_at IS NULL\
"""

HECTARES_QUERY = """\
SELECT sp.uuid AS poly_uuid, h.year_of_analysis, h.indicator_slug, CAST(h.value AS CHAR) AS value
FROM indicator_output_hectares h
INNER JOIN site_polygon sp ON sp.id = h.site_polygon_id
WHERE h.deleted_at IS NULL
  AND h.indicator_slug IN ('restorationByStrategy', 'restorationByLandUse', 'restorationByEcoRegion')\
"""

def _export_geoparquet(
    host: str, port: int, user: str, password: str,
    db: str, output: pathlib.Path,
) -> None:
    """Connect to MariaDB via DuckDB, run the spatial query, write GeoParquet."""
    import duckdb

    con = duckdb.connect()

    print("Installing DuckDB extensions (spatial, mysql)...")
    con.execute("INSTALL spatial; LOAD spatial;")
    con.execute("INSTALL mysql; LOAD mysql;")

    print(f"Attaching MariaDB at {host}:{port}/{db}...")
    con.execute(f"""
        ATTACH 'host={host} port={port} user={user} password={password} database={db}'
        AS mariadb (TYPE MYSQL, READ_ONLY)
    """)

    def esc(q: str) -> str:
        return q.replace("'", "''")

    print("Running queries and writing GeoParquet...")
    con.execute(f"""
        COPY (
            WITH polygons AS (
                SELECT * REPLACE (ST_GeomFromHexWKB(geom) AS geom)
                FROM mysql_query('mariadb', '{esc(POLYGONS_QUERY)}')
            ),
            tree_cover_raw AS (
                SELECT * FROM mysql_query('mariadb', '{esc(TREE_COVER_QUERY)}')
            ),
            tree_cover AS (
                SELECT poly_uuid,
                       MAX(project_phase) AS project_phase,
                       MAP(
                           LIST(year_of_analysis ORDER BY year_of_analysis)
                               FILTER (WHERE year_of_analysis IS NOT NULL),
                           LIST(percent_cover ORDER BY year_of_analysis)
                               FILTER (WHERE year_of_analysis IS NOT NULL)
                       ) AS ttc
                FROM tree_cover_raw
                GROUP BY poly_uuid
            ),
            tree_count_raw AS (
                SELECT * FROM mysql_query('mariadb', '{esc(TREE_COUNT_QUERY)}')
            ),
            tree_count AS (
                SELECT poly_uuid,
                       MAP(
                           LIST(year_of_analysis ORDER BY year_of_analysis)
                               FILTER (WHERE year_of_analysis IS NOT NULL),
                           LIST(tree_count ORDER BY year_of_analysis)
                               FILTER (WHERE year_of_analysis IS NOT NULL)
                       ) AS tree_count_by_year
                FROM tree_count_raw
                GROUP BY poly_uuid
            ),
            hectares_raw AS (
                SELECT * FROM mysql_query('mariadb', '{esc(HECTARES_QUERY)}')
            ),
            hectares_per_slug AS (
                SELECT poly_uuid, indicator_slug,
                       MAP(
                           LIST(year_of_analysis ORDER BY year_of_analysis)
                               FILTER (WHERE year_of_analysis IS NOT NULL),
                           LIST(value ORDER BY year_of_analysis)
                               FILTER (WHERE year_of_analysis IS NOT NULL)
                       ) AS m
                FROM hectares_raw
                GROUP BY poly_uuid, indicator_slug
            ),
            hectares AS (
                SELECT poly_uuid,
                       ANY_VALUE(m) FILTER (WHERE indicator_slug = 'restorationByStrategy')
                           AS restoration_by_strategy,
                       ANY_VALUE(m) FILTER (WHERE indicator_slug = 'restorationByLandUse')
                           AS restoration_by_land_use,
                       ANY_VALUE(m) FILTER (WHERE indicator_slug = 'restorationByEcoRegion')
                           AS restoration_by_eco_region
                FROM hectares_per_slug
                GROUP BY poly_uuid
            )
            SELECT p.*,
                   tc.project_phase,
                   tc.ttc,
                   tcnt.tree_count_by_year,
                   h.restoration_by_strategy,
                   h.restoration_by_land_use,
                   h.restoration_by_eco_region
            FROM polygons p
            LEFT JOIN tree_cover tc ON tc.poly_uuid = p.poly_uuid
            LEFT JOIN tree_count tcnt ON tcnt.poly_uuid = p.poly_uuid
            LEFT JOIN hectares h ON h.poly_uuid = p.poly_uuid
        ) TO '{output}' (FORMAT PARQUET)
    """)

    count = con.execute(f"SELECT count(*) FROM read_parquet('{output}')").fetchone()[0]
    print(f"Wrote {count} rows to {output}")
    con.close()

# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def main():
    p = argparse.ArgumentParser(
        description="Export TerraMatch polygon data from MariaDB to GeoParquet via DuckDB"
    )
    p.add_argument("-o", "--output", default="terramatch_polygons.geoparquet",
                   type=pathlib.Path, help="Output GeoParquet file path")

    p.add_argument("--host", default="")
    p.add_argument("--port", type=int, default=3306)
    p.add_argument("--user", default="admin")
    p.add_argument("--password", default="")
    p.add_argument("--db", default="wri_restoration_marketplace")

    args = p.parse_args()
    args.output.parent.mkdir(parents=True, exist_ok=True)

    _export_geoparquet(
        args.host, args.port, args.user, args.password, args.db, args.output
    )

    print(f"Done -- GeoParquet written to {args.output.resolve()}")

if __name__ == "__main__":
    main()

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

TERRAMATCH_QUERY = """\
SELECT vp.uuid as project_id, vp.name as project_name, vp.country,
       vp.framework_key, vp.short_name, vp.cohort,
       vs.name as site_name, vs.uuid as site_id,
       sp.poly_name, sp.poly_id, sp.plantstart, sp.practice,
       sp.target_sys, sp.status, sp.version_name, sp.is_active,
       sp.source, sp.deleted_at,
       HEX(ST_AsBinary(pg.geom)) as geom
FROM v2_sites vs
INNER JOIN v2_projects vp ON vp.id = vs.project_id
INNER JOIN site_polygon sp ON sp.site_id = vs.uuid
INNER JOIN polygon_geometry pg ON pg.uuid = sp.poly_id
WHERE sp.status = 'approved' AND sp.is_active = 1
      AND sp.deleted_at IS NULL AND sp.plantstart IS NOT NULL
      -- AND vp.cohort LIKE '%terrafund%'
ORDER BY vp.short_name, vs.name, sp.poly_name\
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

    # Escape single quotes for use inside DuckDB's mysql_query() string literal
    escaped_query = TERRAMATCH_QUERY.replace("'", "''")

    print("Running query and writing GeoParquet...")
    con.execute(f"""
        COPY (
            SELECT * REPLACE (ST_GeomFromHexWKB(geom) AS geom)
            FROM mysql_query('mariadb', '{escaped_query}')
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

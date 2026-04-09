/**
 * TM-3169: deterministic schema diff — Sequelize physical columns (getAttributes) vs
 * information_schema.COLUMNS, plus full index list from STATISTICS for model tables only.
 *
 * Run from repository root (Docker MariaDB must be reachable):
 *
 *   npx ts-node --transpile-only -P tsconfig.schema-audit.json libs/database/src/lib/tools/schema-audit-sequelize-vs-db.ts
 *
 * Loads DB_* from `.env` / `.env.local` in repo root.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { Sequelize, Model, ModelCtor } from "sequelize-typescript";
import type { ModelAttributeColumnOptions } from "sequelize";
import * as Entities from "../entities";

/** Human-readable explanations for report consumers (JSON + Markdown). All strings in English. */
const SECTION_GUIDE = {
  intro:
    "This audit answers: (1) which database objects exist outside the Sequelize models in this repo, (2) which column names differ between the ORM definition and the live schema, and (3) which indexes exist on tables that the app still maps to entities. Use it for TM-3169 clean-up planning; it is not a migration generator.",
  methodology:
    "Column comparison uses Sequelize `Model.getAttributes()` after model init (physical `field` names, underscored). Database truth comes from `information_schema.COLUMNS`. Index rows come from `information_schema.STATISTICS` filtered to tables that have a model. Virtual attributes are excluded from the expected column set.",
  scopeBullets: {
    tables:
      "Compare every `tableName` from registered entities against table names present in the current schema (same database as `DB_*` in `.env`).",
    columns:
      "For each table that exists on both sides, compare physical column names the model expects vs columns returned by the server. Mismatches surface as extra-in-DB or missing-in-DB lists.",
    indexes:
      "List every index entry (including PRIMARY, UNIQUE, and secondary indexes backing FKs) for model-backed tables only. This does not assert parity with `@Index` decorators in source — it is the authoritative list from MariaDB."
  },
  summaryMetrics: {
    modelTableCount:
      "Count of distinct Sequelize models (each contributes one `tableName`). Duplicate exports of the same class still count once.",
    dbTableCount:
      "Count of `BASE TABLE` names in `information_schema.TABLES` for this schema (same database as the connection).",
    tablesOnlyInDbCount:
      "Tables that appear in the database but have no Sequelize entity in this repository. Typical sources: legacy PHP/Laravel, Terrafund pipelines, or tables owned by another service.",
    tablesOnlyInModelCount:
      "Models whose `tableName` does not exist in the database on this connection (wrong env, migration not applied, or typo).",
    columnsExtraInDbCount:
      "Total pair count of (table, column) where the column exists in MariaDB but is not part of the model’s physical attributes. Often leftover columns before a migration drops them.",
    columnsMissingInDbCount:
      "Total pair count where the model expects a physical column that does not exist in the database (pending migration, or model ahead of schema).",
    indexEntriesForModelTables:
      "Total rows after expanding `STATISTICS` per table/index (one row per index name per table; composite indexes appear once with multiple columns). Used for index review, not for automatic drop lists."
  },
  tablesOnlyInDb:
    "These tables consume space and may still be referenced by triggers, views, or apps outside this Nest/Sequelize codebase. Treat as candidates for archival or drop only after dependency analysis.",
  columnsExtraInDb:
    "Each entry is a column that still exists in the database but Sequelize does not map. Safe removal usually requires a migration and confirmation that no raw SQL or other services read the column.",
  columnsMissingInDb:
    "Each entry is a column Sequelize expects (from decorators) that is absent in the database. Deployments may fail at runtime when writing these fields until a migration adds the column.",
  indexesInDbForModelTables:
    "`nonUnique: true` means `STATISTICS.NON_UNIQUE = 1` (secondary index allowing duplicates). `false` means UNIQUE or PRIMARY. Column order matches `SEQ_IN_INDEX`. Compare this list to application query patterns when tuning or removing redundant indexes."
} as const;

function loadEnvFromFile(envPath: string): void {
  if (!existsSync(envPath)) return;
  const raw = readFileSync(envPath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

function uniqueModelClasses(): ModelCtor<Model>[] {
  const values = Object.values(Entities).filter((v): v is ModelCtor<Model> => typeof v === "function");
  return [...new Set(values)];
}

function camelToSnake(name: string): string {
  return name
    .replace(/([A-Z])/g, "_$1")
    .toLowerCase()
    .replace(/^_/, "");
}

function physicalColumnNames(model: ModelCtor<Model>): Set<string> {
  const attrs = model.getAttributes();
  const out = new Set<string>();
  for (const [attrKey, def] of Object.entries(attrs)) {
    const d = def as ModelAttributeColumnOptions & { type?: { key?: string } };
    if (d.type && typeof d.type === "object" && "key" in d.type && d.type.key === "VIRTUAL") {
      continue;
    }
    const field = typeof d.field === "string" ? d.field : camelToSnake(attrKey);
    out.add(field);
  }
  return out;
}

async function fetchDbColumns(sequelize: Sequelize, schema: string): Promise<Map<string, Set<string>>> {
  const [rows] = await sequelize.query<{ TABLE_NAME: string; COLUMN_NAME: string }>(
    `SELECT TABLE_NAME, COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = :schema ORDER BY TABLE_NAME, ORDINAL_POSITION`,
    { replacements: { schema } }
  );
  const map = new Map<string, Set<string>>();
  for (const r of rows) {
    if (!map.has(r.TABLE_NAME)) map.set(r.TABLE_NAME, new Set());
    map.get(r.TABLE_NAME)!.add(r.COLUMN_NAME);
  }
  return map;
}

type IndexRow = {
  table: string;
  indexName: string;
  nonUnique: boolean;
  columns: string[];
};

async function fetchIndexesForTables(sequelize: Sequelize, schema: string, tables: string[]): Promise<IndexRow[]> {
  if (tables.length === 0) return [];
  const ph = tables.map(() => "?").join(", ");
  const [rows] = await sequelize.query<{
    TABLE_NAME: string;
    INDEX_NAME: string;
    NON_UNIQUE: number;
    SEQ_IN_INDEX: number;
    COLUMN_NAME: string;
  }>(
    `SELECT TABLE_NAME, INDEX_NAME, NON_UNIQUE, SEQ_IN_INDEX, COLUMN_NAME
     FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME IN (${ph})
     ORDER BY TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX`,
    { replacements: [schema, ...tables] }
  );

  const byKey = new Map<string, { nonUnique: number; cols: string[] }>();
  for (const r of rows) {
    const key = `${r.TABLE_NAME}\0${r.INDEX_NAME}`;
    if (!byKey.has(key)) {
      byKey.set(key, { nonUnique: r.NON_UNIQUE, cols: [] });
    }
    const entry = byKey.get(key)!;
    const cols = entry.cols;
    if (cols.length < r.SEQ_IN_INDEX) cols.length = r.SEQ_IN_INDEX;
    cols[r.SEQ_IN_INDEX - 1] = r.COLUMN_NAME;
  }

  const out: IndexRow[] = [];
  for (const [key, v] of byKey) {
    const [table, indexName] = key.split("\0");
    out.push({
      table,
      indexName,
      nonUnique: v.nonUnique === 1,
      columns: v.cols.filter(Boolean)
    });
  }
  return out.sort((a, b) => a.table.localeCompare(b.table) || a.indexName.localeCompare(b.indexName));
}

async function main(): Promise<void> {
  const repoRoot = process.cwd();
  loadEnvFromFile(resolve(repoRoot, ".env"));
  loadEnvFromFile(resolve(repoRoot, ".env.local"));

  const host = process.env.DB_HOST ?? "localhost";
  const port = Number(process.env.DB_PORT ?? 3360);
  const database = process.env.DB_DATABASE ?? "wri_restoration_marketplace_api";
  const username = process.env.DB_USERNAME ?? "wri";
  const password = process.env.DB_PASSWORD ?? "wri";

  const models = uniqueModelClasses();
  const sequelize = new Sequelize({
    dialect: "mariadb",
    host,
    port,
    username,
    password,
    database,
    logging: false,
    models
  });

  await sequelize.authenticate();

  const dbColumns = await fetchDbColumns(sequelize, database);

  const modelTableNames = new Map<string, ModelCtor<Model>>();
  for (const m of models) {
    modelTableNames.set(m.tableName, m);
  }

  const tablesOnlyInDb: string[] = [];
  const tablesOnlyInModel: string[] = [];

  for (const t of dbColumns.keys()) {
    if (!modelTableNames.has(t)) tablesOnlyInDb.push(t);
  }
  for (const t of modelTableNames.keys()) {
    if (!dbColumns.has(t)) tablesOnlyInModel.push(t);
  }

  const columnsExtraInDb: { table: string; column: string }[] = [];
  const columnsMissingInDb: { table: string; column: string }[] = [];

  for (const [tableName, ModelClass] of modelTableNames) {
    const dbCols = dbColumns.get(tableName);
    const expected = physicalColumnNames(ModelClass);
    if (!dbCols) {
      for (const c of expected) columnsMissingInDb.push({ table: tableName, column: c });
      continue;
    }
    for (const c of dbCols) {
      if (!expected.has(c)) columnsExtraInDb.push({ table: tableName, column: c });
    }
    for (const c of expected) {
      if (!dbCols.has(c)) columnsMissingInDb.push({ table: tableName, column: c });
    }
  }

  const modelTableList = [...modelTableNames.keys()].sort();
  const indexesInDbForModelTables = await fetchIndexesForTables(sequelize, database, modelTableList);

  const outDir = resolve(repoRoot, "tmp/schema-audit");
  mkdirSync(outDir, { recursive: true });

  const report = {
    generated: new Date().toISOString(),
    ticket: "TM-3169",
    scope:
      "Sequelize Model.getAttributes() physical column names vs information_schema.COLUMNS; index inventory from STATISTICS for model tables only (includes PRIMARY, UNIQUE, FK-backed).",
    sectionGuide: SECTION_GUIDE,
    connection: {
      host,
      port,
      database,
      username,
      note: "Password is never written to this report. Values come from process env after loading .env / .env.local."
    },
    summary: {
      modelTableCount: modelTableNames.size,
      dbTableCount: dbColumns.size,
      tablesOnlyInDbCount: tablesOnlyInDb.length,
      tablesOnlyInModelCount: tablesOnlyInModel.length,
      columnsExtraInDbCount: columnsExtraInDb.length,
      columnsMissingInDbCount: columnsMissingInDb.length,
      indexEntriesForModelTables: indexesInDbForModelTables.length
    },
    summaryMetricKeys: {
      modelTableCount: "tables defined by Sequelize models in this repo",
      dbTableCount: "tables present in the connected database schema",
      tablesOnlyInDbCount: "tables in DB without a matching entity file",
      tablesOnlyInModelCount: "entities whose table does not exist in DB",
      columnsExtraInDbCount: "extra (table,column) pairs — column in DB not in model",
      columnsMissingInDbCount: "missing (table,column) pairs — column in model not in DB",
      indexEntriesForModelTables: "index rows listed under indexesInDbForModelTables (expanded from STATISTICS)"
    },
    tablesOnlyInDb: tablesOnlyInDb.sort(),
    tablesOnlyInModel: tablesOnlyInModel.sort(),
    columnsExtraInDb: columnsExtraInDb.sort(
      (a, b) => a.table.localeCompare(b.table) || a.column.localeCompare(b.column)
    ),
    columnsMissingInDb: columnsMissingInDb.sort(
      (a, b) => a.table.localeCompare(b.table) || a.column.localeCompare(b.column)
    ),
    indexesInDbForModelTables,
    indexRowFields: {
      table: "Table name (same as Sequelize `tableName`).",
      indexName: "Index name in MariaDB (PRIMARY for clustered PK).",
      nonUnique:
        "true when NON_UNIQUE=1 in STATISTICS (non-unique secondary index); false for UNIQUE constraints and PRIMARY.",
      columns: "Ordered column names for this index (composite order matches SEQ_IN_INDEX)."
    }
  };

  writeFileSync(resolve(outDir, "tm3169-sequelize-vs-db-report.json"), JSON.stringify(report, null, 2), "utf8");

  const lines: string[] = [
    "# TM-3169 — Sequelize vs MariaDB schema audit",
    "",
    `Generated: ${report.generated}`,
    "",
    "## What this report is",
    "",
    SECTION_GUIDE.intro,
    "",
    SECTION_GUIDE.methodology,
    "",
    "## Scope (ticket)",
    "",
    "- **Tables** — " + SECTION_GUIDE.scopeBullets.tables,
    "- **Columns** — " + SECTION_GUIDE.scopeBullets.columns,
    "- **Indexes** — " + SECTION_GUIDE.scopeBullets.indexes,
    "",
    "## Summary",
    "",
    "Counts below are the fastest way to see drift. Longer explanations are in `sectionGuide.summaryMetrics` in the JSON file.",
    "",
    "| Metric | Value |",
    "|--------|-------|",
    `| Tables in Sequelize | ${report.summary.modelTableCount} |`,
    `| Tables in database | ${report.summary.dbTableCount} |`,
    `| Tables only in DB (no entity in this repo) | ${report.summary.tablesOnlyInDbCount} |`,
    `| Tables in model but missing in DB | ${report.summary.tablesOnlyInModelCount} |`,
    `| Columns in DB not mapped by model | ${report.summary.columnsExtraInDbCount} |`,
    `| Columns expected by model but absent in DB | ${report.summary.columnsMissingInDbCount} |`,
    `| Index entries (model tables) | ${report.summary.indexEntriesForModelTables} |`,
    "",
    "### What each summary metric means",
    "",
    "| Metric | Meaning |",
    "|--------|---------|",
    "| Tables in Sequelize | " + SECTION_GUIDE.summaryMetrics.modelTableCount + " |",
    "| Tables in database | " + SECTION_GUIDE.summaryMetrics.dbTableCount + " |",
    "| Tables only in DB (no entity in this repo) | " + SECTION_GUIDE.summaryMetrics.tablesOnlyInDbCount + " |",
    "| Tables in model but missing in DB | " + SECTION_GUIDE.summaryMetrics.tablesOnlyInModelCount + " |",
    "| Columns in DB not mapped by model | " + SECTION_GUIDE.summaryMetrics.columnsExtraInDbCount + " |",
    "| Columns expected by model but absent in DB | " + SECTION_GUIDE.summaryMetrics.columnsMissingInDbCount + " |",
    "| Index entries (model tables) | " + SECTION_GUIDE.summaryMetrics.indexEntriesForModelTables + " |",
    "",
    "## Tables only in database (no Sequelize entity in this repo)",
    "",
    "> " + SECTION_GUIDE.tablesOnlyInDb,
    "",
    ...tablesOnlyInDb.sort().map(t => `- \`${t}\``),
    "",
    "## Columns present in DB but not in Sequelize model",
    "",
    "> " + SECTION_GUIDE.columnsExtraInDb,
    "",
    ...columnsExtraInDb.map(({ table, column }) => `- \`${table}\`.\`${column}\``),
    "",
    "## Columns expected by Sequelize model but missing in database",
    "",
    "> " + SECTION_GUIDE.columnsMissingInDb,
    "",
    ...columnsMissingInDb.map(({ table, column }) => `- \`${table}\`.\`${column}\``),
    "",
    "## Indexes in database (model tables)",
    "",
    "> " + SECTION_GUIDE.indexesInDbForModelTables,
    "",
    "Format per line: table name · index name · unique vs non-unique · parenthesized column list in order.",
    "",
    ...indexesInDbForModelTables.map(
      ix =>
        `- \`${ix.table}\` · \`${ix.indexName}\` · ${ix.nonUnique ? "non-unique" : "unique"} · (${ix.columns.join(
          ", "
        )})`
    ),
    "",
    "## Reference (JSON)",
    "",
    "The companion `.json` file adds `sectionGuide` (same narrative text), `summaryMetricKeys` (short labels), `indexRowFields` (field meaning for each index object), and `connection.note` about credentials.",
    ""
  ];

  writeFileSync(resolve(outDir, "tm3169-sequelize-vs-db-report.md"), lines.join("\n"), "utf8");

  await sequelize.close();

  // eslint-disable-next-line no-console
  console.log(`Wrote ${resolve(outDir, "tm3169-sequelize-vs-db-report.json")}`);
  // eslint-disable-next-line no-console
  console.log(`Wrote ${resolve(outDir, "tm3169-sequelize-vs-db-report.md")}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

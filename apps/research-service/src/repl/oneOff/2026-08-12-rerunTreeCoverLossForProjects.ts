import { getService } from "@terramatch-microservices/common/util/bootstrap-repl";
import { withoutSqlLogs } from "@terramatch-microservices/common/util/repl/without-sql-logs";
import { IndicatorSlug, TreeCoverLossData } from "@terramatch-microservices/database/constants";
import { IndicatorOutputTreeCoverLoss, Project, Site, SitePolygon } from "@terramatch-microservices/database/entities";
import { chunk, groupBy } from "lodash";
import ProgressBar from "progress";
import { Op } from "sequelize";
import { buildTreeCoverLossValue } from "../../indicators/calculators/tree-cover-loss-value.util";
import { IndicatorsService } from "../../indicators/indicators.service";

export const BATCH_PPC_PROJECT_NAMES = [
  "MEX_22_CI-WWF",
  "MWI_22_WFZ",
  "PER_24_GFG",
  "GTM_22_VERAPACES",
  "BRA_24_CI-PEROA",
  "BRA_24_CI-CEPAN",
  "ESP_22_RA-PALENCIA",
  "GBR_23_ACT"
] as const;

const DEFAULT_SLUGS: IndicatorSlug[] = ["treeCoverLoss", "treeCoverLossFires"];
const DEFAULT_SQL_BATCH_SIZE = 250;
const DEFAULT_GFW_BATCH_SIZE = 50;
const INDICATOR_LOAD_BATCH_SIZE = 250;
const MAX_ERROR_SAMPLES = 20;

export type RerunTreeCoverLossScope = "allApproved" | "projectNames";
export type RerunTreeCoverLossMode = "sqlRemap" | "gfwRefresh";

export type RerunTreeCoverLossForProjectsOptions = {
  /** Default true. When false, projectNames is required. */
  allApproved?: boolean;
  /** Matches Project.name. Required when allApproved is false. */
  projectNames?: readonly string[];
  slugs?: IndicatorSlug[];
  batchSize?: number;
  /** When true, report counts without writing. */
  dryRun?: boolean;
  /** Default false. When true, recalculate via GFW (slow; saturates research-service). */
  refreshFromGfw?: boolean;
};

export type RerunTreeCoverLossForProjectsSummary = {
  dryRun: boolean;
  mode: RerunTreeCoverLossMode;
  scope: RerunTreeCoverLossScope;
  projectNames: string[];
  slugs: IndicatorSlug[];
  polygonCount: number;
  indicatorRowCount: number;
  updated: number;
  skipped: number;
  missingRows: number;
  failed: number;
  errorSamples: Array<{ polygonUuid: string; slug: IndicatorSlug; error: string }>;
};

type RerunErrorSample = RerunTreeCoverLossForProjectsSummary["errorSamples"][number];

type ApprovedPolygon = {
  id: number;
  polygonUuid: string;
  plantStart: Date;
};

type IndicatorRow = {
  sitePolygonId: number;
  indicatorSlug: IndicatorSlug;
  yearOfAnalysis: number;
  value: object;
};

const APPROVED_POLYGON_WHERE = {
  isActive: true,
  status: "approved" as const,
  plantStart: { [Op.ne]: null }
};

function parseStoredYearValues(value: unknown): TreeCoverLossData {
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const stored: TreeCoverLossData = {};
  for (const [year, amount] of Object.entries(value as Record<string, unknown>)) {
    if (typeof amount === "number" && Number.isFinite(amount)) {
      stored[year] = amount;
    }
  }
  return stored;
}

function remapStoredTreeCoverLossValue(existingValue: unknown, plantStart: Date): TreeCoverLossData {
  const stored = parseStoredYearValues(existingValue);
  return buildTreeCoverLossValue(
    Object.entries(stored).map(([year, area__ha]) => ({ year: Number(year), area__ha })),
    result => result.year,
    plantStart
  );
}

function isTreeCoverLossValueRemapped(value: unknown, plantStart: Date): boolean {
  const remapped = remapStoredTreeCoverLossValue(value, plantStart);
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const stored = value as Record<string, unknown>;
  const remappedYears = Object.keys(remapped);
  if (Object.keys(stored).length !== remappedYears.length) {
    return false;
  }

  return remappedYears.every(year => stored[year] === remapped[year]);
}

function toPlantStart(value: Date | string | null): Date | null {
  if (value == null) {
    return null;
  }

  const plantStart = value instanceof Date ? value : new Date(value);
  return isNaN(plantStart.getTime()) ? null : plantStart;
}

function toApprovedPolygons(polygons: SitePolygon[]): ApprovedPolygon[] {
  const approved: ApprovedPolygon[] = [];
  for (const polygon of polygons) {
    const plantStart = toPlantStart(polygon.plantStart);
    if (polygon.polygonUuid == null || plantStart == null) {
      continue;
    }
    approved.push({
      id: polygon.id,
      polygonUuid: polygon.polygonUuid,
      plantStart
    });
  }
  return approved;
}

async function getAllApprovedPolygons(): Promise<ApprovedPolygon[]> {
  const polygons = await SitePolygon.findAll({
    where: APPROVED_POLYGON_WHERE,
    attributes: ["id", "polygonUuid", "plantStart"]
  });

  return toApprovedPolygons(polygons);
}

async function getApprovedPolygonsForProjectNames(projectNames: readonly string[]): Promise<ApprovedPolygon[]> {
  const projects = await Project.findAll({
    where: { name: { [Op.in]: [...projectNames] } },
    attributes: ["id", "name"]
  });

  const foundProjectNames = new Set(
    projects.map(project => project.name).filter((name): name is string => name != null)
  );
  const missingProjectNames = projectNames.filter(name => !foundProjectNames.has(name));
  if (missingProjectNames.length > 0) {
    console.warn(`Projects not found: ${missingProjectNames.join(", ")}`);
  }

  if (projects.length === 0) {
    return [];
  }

  const sites = await Site.findAll({
    where: { projectId: { [Op.in]: projects.map(project => project.id) } },
    attributes: ["uuid"]
  });

  if (sites.length === 0) {
    return [];
  }

  const polygons = await SitePolygon.findAll({
    where: {
      siteUuid: { [Op.in]: sites.map(site => site.uuid) },
      ...APPROVED_POLYGON_WHERE
    },
    attributes: ["id", "polygonUuid", "plantStart"]
  });

  return toApprovedPolygons(polygons);
}

async function resolvePolygons(options: RerunTreeCoverLossForProjectsOptions): Promise<{
  scope: RerunTreeCoverLossScope;
  projectNames: string[];
  polygons: ApprovedPolygon[];
}> {
  const allApproved = options.allApproved !== false;

  if (allApproved) {
    return {
      scope: "allApproved",
      projectNames: [],
      polygons: await getAllApprovedPolygons()
    };
  }

  const projectNames = [...(options.projectNames ?? [])];
  if (projectNames.length === 0) {
    throw new Error("projectNames is required when allApproved is false");
  }

  return {
    scope: "projectNames",
    projectNames,
    polygons: await getApprovedPolygonsForProjectNames(projectNames)
  };
}

function recordError(summary: RerunTreeCoverLossForProjectsSummary, sample: RerunErrorSample): void {
  summary.failed += 1;
  if (summary.errorSamples.length < MAX_ERROR_SAMPLES) {
    summary.errorSamples.push(sample);
  }
}

function printSummary(summary: RerunTreeCoverLossForProjectsSummary): void {
  console.log("\n=== rerunTreeCoverLossForProjects complete ===");
  console.table(summary);
  if (summary.errorSamples.length > 0) {
    console.log("Sample errors:");
    summary.errorSamples.forEach(({ polygonUuid, slug, error }) => console.log(`  - ${slug} ${polygonUuid}: ${error}`));
  }
}

async function loadIndicatorRows(sitePolygonIds: number[], slugs: IndicatorSlug[]): Promise<IndicatorRow[]> {
  const rows: IndicatorRow[] = [];

  for (const batchIds of chunk(sitePolygonIds, INDICATOR_LOAD_BATCH_SIZE)) {
    const batch = await IndicatorOutputTreeCoverLoss.findAll({
      where: {
        sitePolygonId: { [Op.in]: batchIds },
        indicatorSlug: { [Op.in]: slugs }
      },
      attributes: ["sitePolygonId", "indicatorSlug", "yearOfAnalysis", "value"]
    });

    for (const row of batch) {
      rows.push({
        sitePolygonId: row.sitePolygonId,
        indicatorSlug: row.indicatorSlug,
        yearOfAnalysis: row.yearOfAnalysis,
        value: row.value
      });
    }
  }

  return rows;
}

function countMissingRows(polygons: ApprovedPolygon[], rows: IndicatorRow[], slugs: IndicatorSlug[]): number {
  const present = new Set(rows.map(row => `${row.sitePolygonId}:${row.indicatorSlug}`));
  let missing = 0;
  for (const polygon of polygons) {
    for (const slug of slugs) {
      if (!present.has(`${polygon.id}:${slug}`)) {
        missing += 1;
      }
    }
  }
  return missing;
}

async function remapFromStoredValues(
  polygons: ApprovedPolygon[],
  slugs: IndicatorSlug[],
  batchSize: number,
  dryRun: boolean,
  summary: RerunTreeCoverLossForProjectsSummary
): Promise<void> {
  const polygonsById = new Map(polygons.map(polygon => [polygon.id, polygon]));
  const rows = await loadIndicatorRows(
    polygons.map(polygon => polygon.id),
    slugs
  );
  summary.indicatorRowCount = rows.length;
  summary.missingRows = countMissingRows(polygons, rows, slugs);

  const updates: IndicatorRow[] = [];
  for (const row of rows) {
    const polygon = polygonsById.get(row.sitePolygonId);
    if (polygon == null) {
      continue;
    }

    if (isTreeCoverLossValueRemapped(row.value, polygon.plantStart)) {
      summary.skipped += 1;
      continue;
    }

    updates.push({
      sitePolygonId: row.sitePolygonId,
      indicatorSlug: row.indicatorSlug,
      yearOfAnalysis: row.yearOfAnalysis,
      value: remapStoredTreeCoverLossValue(row.value, polygon.plantStart)
    });
  }

  if (dryRun) {
    summary.updated = updates.length;
    return;
  }

  const bar = new ProgressBar("Remapping tree cover loss [:bar] :current/:total :percent :etas", {
    width: 40,
    total: Math.max(updates.length, 1)
  });

  if (updates.length === 0) {
    bar.tick();
    return;
  }

  const indicatorsService = getService(IndicatorsService);
  for (const batch of chunk(updates, batchSize)) {
    const bySlug = groupBy(batch, update => update.indicatorSlug);

    for (const [slug, slugUpdates] of Object.entries(bySlug)) {
      try {
        await indicatorsService.saveResults(
          slugUpdates as Parameters<IndicatorsService["saveResults"]>[0],
          slug as IndicatorSlug
        );
        summary.updated += slugUpdates.length;
      } catch (error) {
        for (const update of slugUpdates) {
          const polygon = polygonsById.get(update.sitePolygonId);
          recordError(summary, {
            polygonUuid: polygon?.polygonUuid ?? String(update.sitePolygonId),
            slug: slug as IndicatorSlug,
            error: error instanceof Error ? error.message : "Unknown error"
          });
        }
      }
    }

    bar.tick(batch.length);
  }
}

async function refreshFromGfw(
  polygons: ApprovedPolygon[],
  slugs: IndicatorSlug[],
  batchSize: number,
  dryRun: boolean,
  summary: RerunTreeCoverLossForProjectsSummary
): Promise<void> {
  if (dryRun) {
    return;
  }

  const indicatorsService = getService(IndicatorsService);
  const polygonUuids = polygons.map(polygon => polygon.polygonUuid);
  const totalOperations = polygonUuids.length * slugs.length;
  const bar = new ProgressBar("Refreshing tree cover loss from GFW [:bar] :current/:total :percent :etas", {
    width: 40,
    total: Math.max(totalOperations, 1)
  });

  for (const slug of slugs) {
    for (const batch of chunk(polygonUuids, batchSize)) {
      const results = [];

      for (const polygonUuid of batch) {
        try {
          results.push(await indicatorsService.processPolygon(slug, polygonUuid));
          summary.updated += 1;
        } catch (error) {
          recordError(summary, {
            polygonUuid,
            slug,
            error: error instanceof Error ? error.message : "Unknown error"
          });
        }

        bar.tick();
      }

      if (results.length > 0) {
        await indicatorsService.saveResults(results, slug);
      }
    }
  }
}

/**
 * One-off (REPL): remap stored TCL/TCLF values to the plantStart year window.
 *
 * Default is a DB-only remap (no GFW). Empty `{}` becomes zeros; existing year values inside
 * the plantStart range are kept. Safe to re-run: already remapped rows are skipped.
 *
 * Usage:
 * - dry run:
 *   tm-v3-cli repl research-service <env> --script "await oneOff.rerunTreeCoverLossForProjects({ dryRun: true })"
 * - execute:
 *   tm-v3-cli repl research-service <env> --script "await oneOff.rerunTreeCoverLossForProjects()"
 * - named projects:
 *   tm-v3-cli repl research-service <env> --script "await oneOff.rerunTreeCoverLossForProjects({ allApproved: false, projectNames: oneOff.BATCH_PPC_PROJECT_NAMES })"
 * - GFW refresh (slow):
 *   tm-v3-cli repl research-service <env> --script "await oneOff.rerunTreeCoverLossForProjects({ refreshFromGfw: true })"
 */
export const rerunTreeCoverLossForProjects = withoutSqlLogs(
  async (options: RerunTreeCoverLossForProjectsOptions = {}): Promise<RerunTreeCoverLossForProjectsSummary> => {
    const slugs = options.slugs ?? DEFAULT_SLUGS;
    const dryRun = options.dryRun === true;
    const mode: RerunTreeCoverLossMode = options.refreshFromGfw === true ? "gfwRefresh" : "sqlRemap";
    const batchSize = options.batchSize ?? (mode === "sqlRemap" ? DEFAULT_SQL_BATCH_SIZE : DEFAULT_GFW_BATCH_SIZE);

    const { scope, projectNames, polygons } = await resolvePolygons(options);
    const summary: RerunTreeCoverLossForProjectsSummary = {
      dryRun,
      mode,
      scope,
      projectNames,
      slugs,
      polygonCount: polygons.length,
      indicatorRowCount: 0,
      updated: 0,
      skipped: 0,
      missingRows: 0,
      failed: 0,
      errorSamples: []
    };

    const scopeLabel =
      scope === "allApproved" ? "all approved polygons with plantStart" : `${projectNames.length} named projects`;

    console.log(
      `rerunTreeCoverLossForProjects: ${polygons.length} polygons for ${scopeLabel} (${mode})` +
        (dryRun ? " (dryRun)" : "") +
        ` [batch=${batchSize}]`
    );

    if (polygons.length === 0) {
      printSummary(summary);
      return summary;
    }

    if (mode === "sqlRemap") {
      await remapFromStoredValues(polygons, slugs, batchSize, dryRun, summary);
    } else {
      await refreshFromGfw(polygons, slugs, batchSize, dryRun, summary);
    }

    printSummary(summary);
    return summary;
  }
);

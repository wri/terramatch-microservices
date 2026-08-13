import { getService } from "@terramatch-microservices/common/util/bootstrap-repl";
import { withoutSqlLogs } from "@terramatch-microservices/common/util/repl/without-sql-logs";
import { IndicatorSlug } from "@terramatch-microservices/database/constants";
import { Project, Site, SitePolygon } from "@terramatch-microservices/database/entities";
import ProgressBar from "progress";
import { Op } from "sequelize";
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
const DEFAULT_BATCH_SIZE = 50;
const MAX_ERROR_SAMPLES = 20;

export type RerunTreeCoverLossScope = "allApproved" | "projectNames";

export type RerunTreeCoverLossForProjectsOptions = {
  /** Default true. When false, projectNames is required. */
  allApproved?: boolean;
  /** Matches Project.name. Required when allApproved is false. */
  projectNames?: readonly string[];
  slugs?: IndicatorSlug[];
  batchSize?: number;
  /** When true, report counts without writing. */
  dryRun?: boolean;
};

export type RerunTreeCoverLossForProjectsSummary = {
  dryRun: boolean;
  scope: RerunTreeCoverLossScope;
  projectNames: string[];
  slugs: IndicatorSlug[];
  polygonCount: number;
  processed: number;
  failed: number;
  errorSamples: Array<{ polygonUuid: string; slug: IndicatorSlug; error: string }>;
};

type RerunErrorSample = RerunTreeCoverLossForProjectsSummary["errorSamples"][number];

const APPROVED_POLYGON_WHERE = {
  isActive: true,
  status: "approved" as const,
  plantStart: { [Op.ne]: null }
};

function toPolygonUuids(polygons: SitePolygon[]): string[] {
  return polygons
    .map(polygon => polygon.polygonUuid)
    .filter((polygonUuid): polygonUuid is string => polygonUuid != null);
}

async function getAllApprovedPolygonUuids(): Promise<string[]> {
  const polygons = await SitePolygon.findAll({
    where: APPROVED_POLYGON_WHERE,
    attributes: ["polygonUuid"]
  });

  return toPolygonUuids(polygons);
}

async function getApprovedPolygonUuidsForProjectNames(projectNames: readonly string[]): Promise<string[]> {
  const projects = await Project.findAll({
    where: { name: { [Op.in]: [...projectNames] } },
    attributes: ["id", "name"]
  });

  const foundProjectNames = new Set(projects.map(project => project.name).filter((name): name is string => name != null));
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
    attributes: ["polygonUuid"]
  });

  return toPolygonUuids(polygons);
}

async function resolvePolygonUuids(options: RerunTreeCoverLossForProjectsOptions): Promise<{
  scope: RerunTreeCoverLossScope;
  projectNames: string[];
  polygonUuids: string[];
}> {
  const allApproved = options.allApproved !== false;

  if (allApproved) {
    return {
      scope: "allApproved",
      projectNames: [],
      polygonUuids: await getAllApprovedPolygonUuids()
    };
  }

  const projectNames = [...(options.projectNames ?? [])];
  if (projectNames.length === 0) {
    throw new Error("projectNames is required when allApproved is false");
  }

  return {
    scope: "projectNames",
    projectNames,
    polygonUuids: await getApprovedPolygonUuidsForProjectNames(projectNames)
  };
}

function recordError(
  summary: RerunTreeCoverLossForProjectsSummary,
  sample: RerunErrorSample
): void {
  summary.failed += 1;
  if (summary.errorSamples.length < MAX_ERROR_SAMPLES) {
    summary.errorSamples.push(sample);
  }
}

/**
 * One-off (REPL): bulk rerun tree cover loss indicators using the plantStart-based calculation.
 *
 * Safe to re-run: overwrites the current yearOfAnalysis row for treeCoverLoss and treeCoverLossFires.
 *
 * Run in research-service REPL:
 *   await oneOff.rerunTreeCoverLossForProjects({ dryRun: true })
 *   await oneOff.rerunTreeCoverLossForProjects()
 *   await oneOff.rerunTreeCoverLossForProjects({ allApproved: false, projectNames: oneOff.BATCH_PPC_PROJECT_NAMES })
 */
export const rerunTreeCoverLossForProjects = withoutSqlLogs(
  async (options: RerunTreeCoverLossForProjectsOptions = {}): Promise<RerunTreeCoverLossForProjectsSummary> => {
    const slugs = options.slugs ?? DEFAULT_SLUGS;
    const batchSize = options.batchSize ?? DEFAULT_BATCH_SIZE;
    const dryRun = options.dryRun === true;

    const { scope, projectNames, polygonUuids } = await resolvePolygonUuids(options);
    const summary: RerunTreeCoverLossForProjectsSummary = {
      dryRun,
      scope,
      projectNames,
      slugs,
      polygonCount: polygonUuids.length,
      processed: 0,
      failed: 0,
      errorSamples: []
    };

    const scopeLabel =
      scope === "allApproved"
        ? "all approved polygons with plantStart"
        : `${projectNames.length} named projects`;

    console.log(
      `rerunTreeCoverLossForProjects: ${polygonUuids.length} polygons for ${scopeLabel}` + (dryRun ? " (dryRun)" : "")
    );

    if (dryRun || polygonUuids.length === 0) {
      console.log("\n=== rerunTreeCoverLossForProjects complete ===");
      console.table(summary);
      return summary;
    }

    const indicatorsService = getService(IndicatorsService);
    const totalOperations = polygonUuids.length * slugs.length;
    const bar = new ProgressBar("Rerunning tree cover loss [:bar] :current/:total :percent :etas", {
      width: 40,
      total: Math.max(totalOperations, 1)
    });

    for (const slug of slugs) {
      for (let index = 0; index < polygonUuids.length; index += batchSize) {
        const batch = polygonUuids.slice(index, index + batchSize);
        const results = [];

        for (const polygonUuid of batch) {
          try {
            results.push(await indicatorsService.processPolygon(slug, polygonUuid));
            summary.processed += 1;
          } catch (error) {
            recordError(summary, {
              polygonUuid,
              slug,
              error: error instanceof Error ? error.message : String(error)
            });
          }

          bar.tick();
        }

        if (results.length > 0) {
          await indicatorsService.saveResults(results, slug);
        }
      }
    }

    console.log("\n=== rerunTreeCoverLossForProjects complete ===");
    console.table(summary);
    if (summary.errorSamples.length > 0) {
      console.log("Sample errors:");
      summary.errorSamples.forEach(({ polygonUuid, slug, error }) =>
        console.log(`  - ${slug} ${polygonUuid}: ${error}`)
      );
    }

    return summary;
  }
);

import { withoutSqlLogs } from "@terramatch-microservices/common/util/repl/without-sql-logs";
import { Project, Site } from "@terramatch-microservices/database/entities";
import { Transaction } from "sequelize";

type SiteReassignment = {
  siteUuid: string;
  name: string;
};

type ReassignVokenelSitesOptions = {
  dryRun?: boolean;
  sites?: SiteReassignment[];
  currentProjectUuid?: string;
  targetProjectUuid?: string;
};

type MigrationCounts = {
  updated: number;
  skipped: number;
  errors: string[];
};

const CURRENT_PROJECT_UUID = "ae90b323-03df-4fb1-bd91-6f05f5236922";
const TARGET_PROJECT_UUID = "40d5e39c-14d1-4a79-a4c1-e34485c97dc1";

const SITE_TARGETS: SiteReassignment[] = [
  { siteUuid: "59872c2e-4cc1-4eb6-8c2d-ac82d1883385", name: "Vokenel1_Kibwezi_Agroforestry" },
  { siteUuid: "45ceaadd-4766-441a-a62f-6b191be9e2a0", name: "Vokenel2_Munyenze_Agroforestry" },
  { siteUuid: "cc4aa5cc-1166-437f-8ca9-951898ab943e", name: "Vokenel3_Nzambani_Agroforestry" }
];

/**
 * Reassigns three Vokenel site profiles from Cohort 2 Landscapes to Cohort 3.
 *
 * Usage:
 * - dry run:
 *   tm-v3-cli repl entity-service <env> --script "await oneOff.reassignVokenelSites({ dryRun: true })"
 * - execute:
 *   tm-v3-cli repl entity-service <env> --script "await oneOff.reassignVokenelSites({ dryRun: false })"
 */
export const reassignVokenelSites = withoutSqlLogs(async (opts: ReassignVokenelSitesOptions = {}) => {
  const dryRun = opts.dryRun ?? true;
  const sites = opts.sites ?? SITE_TARGETS;
  const currentProjectUuid = opts.currentProjectUuid ?? CURRENT_PROJECT_UUID;
  const targetProjectUuid = opts.targetProjectUuid ?? TARGET_PROJECT_UUID;

  console.log(`\nreassign:vokenel-sites ${dryRun ? "[DRY RUN]" : "[EXECUTE]"}`);
  console.log(`Sites: ${sites.length}, ${currentProjectUuid} -> ${targetProjectUuid}`);

  const sequelize = Site.sequelize;
  if (sequelize == null) {
    throw new Error("Site sequelize instance not available");
  }

  const run = async (transaction?: Transaction): Promise<MigrationCounts> => {
    const counts: MigrationCounts = { updated: 0, skipped: 0, errors: [] };

    const currentProject = await Project.findOne({
      where: { uuid: currentProjectUuid },
      attributes: ["id", "uuid", "name"],
      transaction
    });

    if (currentProject == null) {
      throw new Error(`Current project uuid=${currentProjectUuid} not found`);
    }

    const targetProject = await Project.findOne({
      where: { uuid: targetProjectUuid },
      attributes: ["id", "uuid", "name"],
      transaction
    });

    if (targetProject == null) {
      throw new Error(`Target project uuid=${targetProjectUuid} not found`);
    }

    console.log(`Current project: ${currentProject.id} (${currentProject.name})`);
    console.log(`Target project: ${targetProject.id} (${targetProject.name})`);

    for (const target of sites) {
      const site = await Site.findOne({
        where: { uuid: target.siteUuid },
        attributes: ["id", "uuid", "name", "projectId"],
        transaction
      });

      if (site == null) {
        counts.errors.push(`Site uuid=${target.siteUuid} (${target.name}): record not found`);
        counts.skipped++;
        continue;
      }

      if (site.name !== target.name) {
        counts.errors.push(`Site uuid=${target.siteUuid}: name mismatch (expected ${target.name}, found ${site.name})`);
        counts.skipped++;
        continue;
      }

      if (site.projectId !== currentProject.id) {
        counts.errors.push(
          `Site uuid=${target.siteUuid}: projectId mismatch (expected ${currentProject.id}, found ${site.projectId})`
        );
        counts.skipped++;
        continue;
      }

      if (site.projectId === targetProject.id) {
        console.log(`Site ${site.id} (${target.siteUuid}): already linked to target project — skipping`);
        counts.skipped++;
        continue;
      }

      console.log(
        `Site ${site.id} (${target.siteUuid}, ${site.name}): projectId ${currentProject.id} -> ${targetProject.id}`
      );

      if (!dryRun) {
        await site.update({ projectId: targetProject.id }, { transaction });
      }

      counts.updated++;
    }

    return counts;
  };

  const results = dryRun ? await run() : await sequelize.transaction(async transaction => run(transaction));

  console.log("\nResults:");
  console.log(`  updated: ${results.updated}, skipped: ${results.skipped}`);
  if (results.errors.length > 0) {
    console.log(`  Errors:\n    ${results.errors.join("\n    ")}`);
    throw new Error(`Migration aborted with ${results.errors.length} validation error(s)`);
  }

  return results;
});

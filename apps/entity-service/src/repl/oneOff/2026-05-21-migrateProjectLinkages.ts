import { withoutSqlLogs } from "@terramatch-microservices/common/util/repl/without-sql-logs";
import { Investment, Project, ProjectReport, Site } from "@terramatch-microservices/database/entities";
import { Model, ModelStatic, Transaction } from "sequelize";

type ProjectLinkageTarget = {
  id: number;
  uuid: string;
  currentProjectId: number;
  migratedProjectId: number;
};

type MigrateProjectLinkagesOptions = {
  dryRun?: boolean;
  sites?: ProjectLinkageTarget[];
  investments?: ProjectLinkageTarget[];
  projectReports?: ProjectLinkageTarget[];
};

type MigrationCounts = {
  updated: number;
  skipped: number;
  errors: string[];
};

type ProjectLinkedModel = Model & {
  id: number;
  uuid: string;
  projectId: number;
};

const DEFAULT_SITE_TARGETS: ProjectLinkageTarget[] = [
  { id: 1724, uuid: "fe1cdf8f-5ee5-48c6-8496-bd4217bf5551", currentProjectId: 132, migratedProjectId: 687 },
  { id: 1723, uuid: "7ecc9da8-c462-428d-94c6-58d89aef9221", currentProjectId: 132, migratedProjectId: 687 }
];

const DEFAULT_INVESTMENT_TARGETS: ProjectLinkageTarget[] = [
  { id: 8, uuid: "01e1c0da-e65f-47d3-8119-a81e6a52ddf9", currentProjectId: 92, migratedProjectId: 572 },
  { id: 42, uuid: "1d641f34-e30c-43f7-971d-8ff87773ee06", currentProjectId: 132, migratedProjectId: 687 },
  { id: 60, uuid: "b458fccc-7d35-4f31-bc1a-6532c14cbd44", currentProjectId: 124, migratedProjectId: 615 },
  { id: 61, uuid: "02ff36a4-b6e4-4878-90f7-cfd67676fa5b", currentProjectId: 124, migratedProjectId: 615 },
  { id: 62, uuid: "2a8dd9f4-dec9-4986-ba54-27c8f184ca14", currentProjectId: 124, migratedProjectId: 929 },
  { id: 80, uuid: "1571b1a5-4fe8-48ce-b039-ec3ad0ddda2b", currentProjectId: 114, migratedProjectId: 326 },
  { id: 81, uuid: "07657082-6a12-4b09-b952-f91ea687a7c3", currentProjectId: 114, migratedProjectId: 326 }
];

const DEFAULT_PROJECT_REPORT_TARGETS: ProjectLinkageTarget[] = [
  { id: 1192, uuid: "1c4cd7dd-2fc0-4188-bb7c-643838060d5f", currentProjectId: 92, migratedProjectId: 572 },
  { id: 3258, uuid: "df4df673-2401-46e0-ba55-22a8201eb01b", currentProjectId: 92, migratedProjectId: 572 },
  { id: 3617, uuid: "41293deb-4bfe-4269-b37a-7dccf832f41d", currentProjectId: 92, migratedProjectId: 572 },
  { id: 4061, uuid: "b194401a-3135-4609-aac6-a0bf72293dd5", currentProjectId: 92, migratedProjectId: 572 },
  { id: 1345, uuid: "d07a1bb3-aa61-494c-a14a-0e36f690a5bd", currentProjectId: 132, migratedProjectId: 687 },
  { id: 3270, uuid: "f17421a4-ce2c-423e-8558-c56d1acba16c", currentProjectId: 132, migratedProjectId: 687 },
  { id: 3633, uuid: "f93522bc-527a-4a78-858c-48f32f6fceb5", currentProjectId: 132, migratedProjectId: 687 },
  { id: 4070, uuid: "e7da8ec2-76c1-44e2-b8d7-19ffe476ad38", currentProjectId: 132, migratedProjectId: 687 },
  { id: 1317, uuid: "d8a50d62-235a-4e70-90f8-afc770750341", currentProjectId: 124, migratedProjectId: 615 },
  { id: 3267, uuid: "3e2c01fc-e9f3-480e-a942-11cac3ad0afb", currentProjectId: 124, migratedProjectId: 929 },
  { id: 3627, uuid: "d9a12eaa-2a6d-490f-9a7e-8287b298c2e2", currentProjectId: 124, migratedProjectId: 929 },
  { id: 4066, uuid: "c5b14951-aceb-43f8-b430-eb642a0055c8", currentProjectId: 124, migratedProjectId: 929 },
  { id: 1284, uuid: "4ac3e4ec-4f74-4dea-afa8-7d8f26cea346", currentProjectId: 114, migratedProjectId: 326 },
  { id: 3263, uuid: "17df75da-2939-4278-bbf9-5ba026222e83", currentProjectId: 114, migratedProjectId: 326 },
  { id: 3622, uuid: "067b2672-542f-4336-b4aa-e20ee3ad9ff0", currentProjectId: 114, migratedProjectId: 326 },
  { id: 4063, uuid: "dadc98b6-0706-46d7-a55d-ba68cf070cd7", currentProjectId: 114, migratedProjectId: 326 }
];

const migrateTable = async (
  label: string,
  model: ModelStatic<ProjectLinkedModel>,
  targets: ProjectLinkageTarget[],
  dryRun: boolean,
  transaction?: Transaction
): Promise<MigrationCounts> => {
  const counts: MigrationCounts = { updated: 0, skipped: 0, errors: [] };

  for (const target of targets) {
    const row = await model.findOne({
      where: { id: target.id },
      attributes: ["id", "uuid", "projectId"],
      transaction
    });

    if (row == null) {
      counts.errors.push(`${label} id=${target.id}: record not found`);
      counts.skipped++;
      continue;
    }

    if (row.uuid !== target.uuid) {
      counts.errors.push(`${label} id=${target.id}: uuid mismatch (expected ${target.uuid}, found ${row.uuid})`);
      counts.skipped++;
      continue;
    }

    if (row.projectId !== target.currentProjectId) {
      counts.errors.push(
        `${label} id=${target.id}: projectId mismatch (expected ${target.currentProjectId}, found ${row.projectId})`
      );
      counts.skipped++;
      continue;
    }

    if (row.projectId === target.migratedProjectId) {
      console.log(`${label} id=${target.id}: already linked to project ${target.migratedProjectId} — skipping`);
      counts.skipped++;
      continue;
    }

    const targetProject = await Project.findByPk(target.migratedProjectId, {
      attributes: ["id"],
      paranoid: false,
      transaction
    });

    if (targetProject == null) {
      counts.errors.push(`${label} id=${target.id}: target project ${target.migratedProjectId} not found`);
      counts.skipped++;
      continue;
    }

    console.log(
      `${label} id=${target.id} (${target.uuid}): projectId ${target.currentProjectId} -> ${target.migratedProjectId}`
    );

    if (!dryRun) {
      await row.update({ projectId: target.migratedProjectId }, { transaction });
    }

    counts.updated++;
  }

  return counts;
};

/**
 * Migrates project_id linkages for sites, investments, and project reports.
 *
 * Usage:
 * - dry run:
 *   tm-v3-cli repl entity-service <env> --script "await oneOff.migrateProjectLinkages({ dryRun: true })"
 * - execute:
 *   tm-v3-cli repl entity-service <env> --script "await oneOff.migrateProjectLinkages({ dryRun: false })"
 */
export const migrateProjectLinkages = withoutSqlLogs(async (opts: MigrateProjectLinkagesOptions = {}) => {
  const dryRun = opts.dryRun ?? true;
  const sites = opts.sites ?? DEFAULT_SITE_TARGETS;
  const investments = opts.investments ?? DEFAULT_INVESTMENT_TARGETS;
  const projectReports = opts.projectReports ?? DEFAULT_PROJECT_REPORT_TARGETS;

  console.log(`\nmigrate:project-linkages ${dryRun ? "[DRY RUN]" : "[EXECUTE]"}`);
  console.log(`Sites: ${sites.length}, Investments: ${investments.length}, Project reports: ${projectReports.length}`);

  const sequelize = Project.sequelize;
  if (sequelize == null) {
    throw new Error("Project sequelize instance not available");
  }

  const run = async (transaction?: Transaction) => {
    const siteCounts = await migrateTable("Site", Site, sites, dryRun, transaction);
    const investmentCounts = await migrateTable("Investment", Investment, investments, dryRun, transaction);
    const projectReportCounts = await migrateTable("ProjectReport", ProjectReport, projectReports, dryRun, transaction);

    return { sites: siteCounts, investments: investmentCounts, projectReports: projectReportCounts };
  };

  const results = dryRun ? await run() : await sequelize.transaction(async transaction => run(transaction));

  console.log("\nResults:");
  for (const [table, counts] of Object.entries(results)) {
    console.log(`  ${table}: ${counts.updated} updated, ${counts.skipped} skipped`);
    if (counts.errors.length > 0) {
      console.log(`  Errors:\n    ${counts.errors.join("\n    ")}`);
    }
  }

  const totalErrors = Object.values(results).flatMap(({ errors }) => errors);
  if (totalErrors.length > 0) {
    throw new Error(`Migration aborted with ${totalErrors.length} validation error(s)`);
  }

  return results;
});

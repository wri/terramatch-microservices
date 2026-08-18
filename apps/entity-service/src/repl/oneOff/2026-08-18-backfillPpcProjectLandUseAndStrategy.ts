import { withoutSqlLogs } from "@terramatch-microservices/common/util/repl/without-sql-logs";
import { Project, Site } from "@terramatch-microservices/database/entities";
import { isEmpty, uniq } from "lodash";

type BackfillPpcProjectLandUseAndStrategyOptions = {
  dryRun?: boolean;
  projectUuids?: string[];
};

type BackfillCounts = {
  updated: number;
  skipped: number;
  missing: number;
};

const TICKET_PROJECT_UUIDS = [
  "d2c2a1fe-c5e8-435a-b865-00dce7a9809f",
  "468bee12-bfbc-4387-a00a-d7e915576427",
  "6d9089aa-2a6f-4dc0-8064-32c5b67ffed6",
  "1115dda6-0165-4099-b52f-0ac53595c3a9",
  "02b3119e-9505-4dba-b58d-f2a967b71ef9",
  "244eaf7e-e109-47b2-b84e-9ebe24508391",
  "c8ef8d8e-a75a-46f4-88d4-8057ed5a50f8",
  "b3530045-b307-44b1-b987-f61009d33e8b",
  "f17dd6cf-8187-4edd-895e-07013d4990c9",
  "24d8c9a2-b8ef-481c-930b-78c9aeaf239e",
  "b544c4e7-d335-473c-9126-c87309416071",
  "7e7d390b-1894-4a1b-acc2-c531f213c1ca",
  "ad149677-7ee0-479c-8d23-aa8c3bf58532",
  "bbdb4a25-ba0c-4d12-9412-71824a49977e",
  "7a59063e-08ec-42a1-9d56-d6bcda3789df",
  "517c5def-8e83-4963-841e-9dbb38ea7c86",
  "b565f9da-ba5a-40c2-9951-fc176434f8a5",
  "0dcfa582-bdc4-44dd-bb3d-b03a0fb5b67f",
  "c1020fec-836d-4196-a321-e1cdfa159dd2",
  "3ca98137-ad7a-4849-bdf9-f1e6ccdfb40f",
  "b399dd24-0330-4abd-b3b9-acfb30e511eb",
  "04f56bae-d548-40e1-813b-78e5d85383a9",
  "9a3596ac-fa14-4de0-a10b-f5164f8f1196",
  "5a49e268-80f8-4fe9-a802-c29ad5534629",
  "2031d882-5d27-49b9-9cf1-efc5e486d1e1",
  "7aef4ffe-72d6-4e29-968d-e42c4142b533",
  "e4108d7a-58d8-4604-8dd8-2f95c9c181d5",
  "465f543e-d53a-4356-ae8d-9790aa42d30e",
  "5bb542b2-0efb-4b52-841f-2b5898f533b8",
  "001af48f-8f82-499c-a5d1-07d3d2c37de4",
  "1977b649-908c-46c3-836d-f4f6485427c2",
  "956f88c2-e01f-4688-a523-550ff9a8d7fc",
  "dc4d7f6a-ed16-470d-86af-44a04fffce50",
  "1673d710-ea25-46e0-b793-d0afbd54d00c",
  "4985100c-1cc4-4569-98b9-c4671df6b286",
  "b5299296-2621-420e-86d8-9105b4af5aee"
];

const uniqueSlugs = (values: (string[] | null | undefined)[]) =>
  uniq(values.flatMap(value => value ?? []).filter(slug => slug !== "")).sort();

const isMissing = (value: string[] | null | undefined) => value == null || isEmpty(value);

export const backfillPpcProjectLandUseAndStrategy = withoutSqlLogs(
  async (opts: BackfillPpcProjectLandUseAndStrategyOptions = {}) => {
    const dryRun = opts.dryRun ?? true;
    const projectUuids = opts.projectUuids ?? TICKET_PROJECT_UUIDS;

    console.log(`\nbackfill:ppc-project-land-use-and-strategy ${dryRun ? "[DRY RUN]" : "[EXECUTE]"}`);
    console.log(`Projects to process: ${projectUuids.length}`);

    const counts: BackfillCounts = { updated: 0, skipped: 0, missing: 0 };

    for (const uuid of projectUuids) {
      const project = await Project.findOne({
        where: { uuid },
        attributes: ["id", "uuid", "name", "landUseTypes", "restorationStrategy"]
      });

      if (project == null) {
        console.log(`Project ${uuid}: not found — skipping`);
        counts.missing++;
        continue;
      }

      const sites = await Site.project(project.id).findAll({
        attributes: ["landUseTypes", "restorationStrategy"]
      });
      const nextLandUseTypes = uniqueSlugs(sites.map(site => site.landUseTypes));
      const nextRestorationStrategy = uniqueSlugs(sites.map(site => site.restorationStrategy));

      if (nextLandUseTypes.length === 0 && nextRestorationStrategy.length === 0) {
        console.log(`Project ${project.uuid} (${project.name ?? "unnamed"}): no site-level data — skipping`);
        counts.skipped++;
        continue;
      }

      const updates: { landUseTypes?: string[]; restorationStrategy?: string[] } = {};
      if (isMissing(project.landUseTypes) && nextLandUseTypes.length > 0) {
        updates.landUseTypes = nextLandUseTypes;
      }
      if (isMissing(project.restorationStrategy) && nextRestorationStrategy.length > 0) {
        updates.restorationStrategy = nextRestorationStrategy;
      }

      if (isEmpty(updates)) {
        console.log(`Project ${project.uuid} (${project.name ?? "unnamed"}): already populated — skipping`);
        counts.skipped++;
        continue;
      }

      console.log(
        `Project ${project.uuid} (${project.name ?? "unnamed"}): ${JSON.stringify(project.landUseTypes)} / ${JSON.stringify(project.restorationStrategy)} -> ${JSON.stringify(updates.landUseTypes ?? project.landUseTypes)} / ${JSON.stringify(updates.restorationStrategy ?? project.restorationStrategy)}`
      );

      if (!dryRun) {
        await project.update(updates);
      }

      counts.updated++;
    }

    console.log("\nResults:");
    console.log(`  updated: ${counts.updated}, skipped: ${counts.skipped}, missing: ${counts.missing}`);

    return counts;
  }
);

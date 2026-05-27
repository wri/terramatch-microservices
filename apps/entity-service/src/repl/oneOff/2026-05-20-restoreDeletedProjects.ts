import { withoutSqlLogs } from "@terramatch-microservices/common/util/repl/without-sql-logs";
import {
  Action,
  Media,
  Nursery,
  NurseryReport,
  Organisation,
  Project,
  ProjectReport,
  Site,
  SiteReport
} from "@terramatch-microservices/database/entities";
import { laravelType } from "@terramatch-microservices/database/types/util";
import { Model, ModelStatic, Transaction } from "sequelize";
import { Op, WhereOptions } from "sequelize";

type RestoreDeletedProjectsOptions = {
  dryRun?: boolean;
  /** Defaults to the four projects from TM restore ticket (2026-05-20). */
  projectUuids?: string[];
  /** Grace period after project deletion for cascade soft-deletes. Defaults to 30 minutes. */
  cascadeWindowMinutes?: number;
};

type ProjectRestoreTarget = {
  uuid: string;
  expectedOrganisationName?: string;
};

type EntityRestoreCounts = {
  siteReports: number;
  nurseryReports: number;
  projectReports: number;
  sites: number;
  nurseries: number;
  media: number;
  actions: number;
  projects: number;
};

const DEFAULT_TARGETS: ProjectRestoreTarget[] = [
  { uuid: "385e647c-0b37-42e2-a7ee-b8c8fb454de1", expectedOrganisationName: "Green Pot Enterprises" },
  { uuid: "a296d246-7545-4c8d-8781-49876ec03ba9", expectedOrganisationName: "Afrex Gold" },
  { uuid: "b19c9cb1-8cb3-41f8-8aa7-5104e2ae9897", expectedOrganisationName: "Exotic EPZ" },
  {
    uuid: "a47c6c63-0558-49ca-9dfa-c26ce39981bf",
    expectedOrganisationName: "Coopérative des Cafeiculteurs Tuungane (COCAT)"
  }
];

const emptyCounts = (): EntityRestoreCounts => ({
  siteReports: 0,
  nurseryReports: 0,
  projectReports: 0,
  sites: 0,
  nurseries: 0,
  media: 0,
  actions: 0,
  projects: 0
});

const addCounts = (total: EntityRestoreCounts, partial: EntityRestoreCounts) => {
  for (const key of Object.keys(partial) as (keyof EntityRestoreCounts)[]) {
    total[key] += partial[key];
  }
};

const deletedWithinProjectCascade = (projectDeletedAt: Date, cascadeWindowMinutes: number): WhereOptions => {
  const windowStart = new Date(projectDeletedAt.getTime() - 5_000);
  const windowEnd = new Date(projectDeletedAt.getTime() + cascadeWindowMinutes * 60_000);

  return {
    deletedAt: {
      [Op.gte]: windowStart,
      [Op.lte]: windowEnd
    }
  };
};

const restoreRows = async (
  model: ModelStatic<Model>,
  where: WhereOptions,
  dryRun: boolean,
  transaction?: Transaction
): Promise<number> => {
  if (dryRun) {
    return model.count({ where, paranoid: false });
  }

  const [count] = await model.update({ deletedAt: null }, { where, paranoid: false, transaction });
  return count;
};

const restoreByIds = async (
  model: ModelStatic<Model>,
  ids: number[],
  cascadeWhere: WhereOptions,
  dryRun: boolean,
  transaction?: Transaction
): Promise<number> => {
  if (ids.length === 0) {
    return 0;
  }

  return restoreRows(model, { id: { [Op.in]: ids }, ...cascadeWhere }, dryRun, transaction);
};

const buildActionWhere = (
  project: Project,
  siteIds: number[],
  nurseryIds: number[],
  projectReportIds: number[],
  siteReportIds: number[],
  nurseryReportIds: number[]
): WhereOptions[] => [
  { projectId: project.id },
  { targetableType: laravelType(Project), targetableId: project.id },
  ...(siteIds.length > 0 ? [{ targetableType: laravelType(Site), targetableId: { [Op.in]: siteIds } }] : []),
  ...(nurseryIds.length > 0 ? [{ targetableType: laravelType(Nursery), targetableId: { [Op.in]: nurseryIds } }] : []),
  ...(projectReportIds.length > 0
    ? [{ targetableType: laravelType(ProjectReport), targetableId: { [Op.in]: projectReportIds } }]
    : []),
  ...(siteReportIds.length > 0
    ? [{ targetableType: laravelType(SiteReport), targetableId: { [Op.in]: siteReportIds } }]
    : []),
  ...(nurseryReportIds.length > 0
    ? [{ targetableType: laravelType(NurseryReport), targetableId: { [Op.in]: nurseryReportIds } }]
    : [])
];

/**
 * Restores soft-deleted project profiles and entities cascade-deleted with them (sites, nurseries,
 * reports, media, actions). Does not recreate hard-deleted S3 objects if media cleanup already ran.
 *
 * Usage:
 * - dry run:
 *   tm-v3-cli repl entity-service <env> --script "await oneOff.restoreDeletedProjects({ dryRun: true })"
 * - execute:
 *   tm-v3-cli repl entity-service <env> --script "await oneOff.restoreDeletedProjects({ dryRun: false })"
 */
export const restoreDeletedProjects = withoutSqlLogs(async (opts: RestoreDeletedProjectsOptions = {}) => {
  const dryRun = opts.dryRun ?? true;
  const cascadeWindowMinutes = opts.cascadeWindowMinutes ?? 30;
  const targets =
    opts.projectUuids == null
      ? DEFAULT_TARGETS
      : opts.projectUuids.map(uuid => ({ uuid, expectedOrganisationName: undefined }));

  console.log(`\nrestore:deleted-projects ${dryRun ? "[DRY RUN]" : "[EXECUTE]"}`);
  console.log(`Targets: ${targets.map(({ uuid }) => uuid).join(", ")}`);

  const totals = emptyCounts();
  const sequelize = Project.sequelize;
  if (sequelize == null) {
    throw new Error("Project sequelize instance not available");
  }

  const runForProject = async (target: ProjectRestoreTarget): Promise<EntityRestoreCounts> => {
    const counts = emptyCounts();
    const project = await Project.findOne({
      where: { uuid: target.uuid },
      paranoid: false,
      include: [{ model: Organisation, attributes: ["id", "name"] }]
    });

    if (project == null) {
      console.warn(`Project ${target.uuid} not found — skipping`);
      return counts;
    }

    if (project.deletedAt == null) {
      console.warn(`Project ${target.uuid} (${project.name ?? "unnamed"}) is not deleted — skipping`);
      return counts;
    }

    const organisationName = project.organisation?.name;
    if (
      target.expectedOrganisationName != null &&
      organisationName != null &&
      organisationName !== target.expectedOrganisationName
    ) {
      console.warn(
        `Project ${target.uuid}: organisation name mismatch (expected "${target.expectedOrganisationName}", found "${organisationName}")`
      );
    }

    console.log(
      `\nProject ${project.uuid} (${project.name ?? "unnamed"}) deleted at ${project.deletedAt.toISOString()}`
    );

    const cascadeWhere = deletedWithinProjectCascade(project.deletedAt, cascadeWindowMinutes);

    const [sites, nurseries, projectReports] = await Promise.all([
      Site.findAll({
        where: { projectId: project.id, ...cascadeWhere },
        paranoid: false,
        attributes: ["id"]
      }),
      Nursery.findAll({
        where: { projectId: project.id, ...cascadeWhere },
        paranoid: false,
        attributes: ["id"]
      }),
      ProjectReport.findAll({
        where: { projectId: project.id, ...cascadeWhere },
        paranoid: false,
        attributes: ["id"]
      })
    ]);

    const siteIds = sites.map(({ id }) => id);
    const nurseryIds = nurseries.map(({ id }) => id);
    const projectReportIds = projectReports.map(({ id }) => id);

    const [siteReports, nurseryReports] = await Promise.all([
      siteIds.length === 0
        ? Promise.resolve([])
        : SiteReport.findAll({
            where: { siteId: { [Op.in]: siteIds }, ...cascadeWhere },
            paranoid: false,
            attributes: ["id"]
          }),
      nurseryIds.length === 0
        ? Promise.resolve([])
        : NurseryReport.findAll({
            where: { nurseryId: { [Op.in]: nurseryIds }, ...cascadeWhere },
            paranoid: false,
            attributes: ["id"]
          })
    ]);

    const siteReportIds = siteReports.map(({ id }) => id);
    const nurseryReportIds = nurseryReports.map(({ id }) => id);

    const mediaOwners: Array<{ modelType: string; modelId: number }> = [
      { modelType: laravelType(Project), modelId: project.id },
      ...sites.map(({ id }) => ({ modelType: laravelType(Site), modelId: id })),
      ...nurseries.map(({ id }) => ({ modelType: laravelType(Nursery), modelId: id })),
      ...projectReports.map(({ id }) => ({ modelType: laravelType(ProjectReport), modelId: id })),
      ...siteReports.map(({ id }) => ({ modelType: laravelType(SiteReport), modelId: id })),
      ...nurseryReports.map(({ id }) => ({ modelType: laravelType(NurseryReport), modelId: id }))
    ];

    const actionWhere = buildActionWhere(
      project,
      siteIds,
      nurseryIds,
      projectReportIds,
      siteReportIds,
      nurseryReportIds
    );

    const restoreProjectTree = async (transaction?: Transaction) => {
      counts.siteReports = await restoreByIds(SiteReport, siteReportIds, cascadeWhere, dryRun, transaction);
      counts.nurseryReports = await restoreByIds(NurseryReport, nurseryReportIds, cascadeWhere, dryRun, transaction);
      counts.projectReports = await restoreByIds(ProjectReport, projectReportIds, cascadeWhere, dryRun, transaction);
      counts.sites = await restoreByIds(Site, siteIds, cascadeWhere, dryRun, transaction);
      counts.nurseries = await restoreByIds(Nursery, nurseryIds, cascadeWhere, dryRun, transaction);

      if (mediaOwners.length > 0) {
        counts.media = await restoreRows(
          Media,
          {
            [Op.or]: mediaOwners.map(({ modelType, modelId }) => ({ modelType, modelId })),
            ...cascadeWhere
          },
          dryRun,
          transaction
        );
      }

      counts.actions = await restoreRows(
        Action,
        {
          [Op.and]: [{ [Op.or]: actionWhere }, cascadeWhere]
        },
        dryRun,
        transaction
      );

      counts.projects = await restoreRows(Project, { id: project.id, ...cascadeWhere }, dryRun, transaction);
    };

    if (dryRun) {
      await restoreProjectTree();
    } else {
      await sequelize.transaction(async transaction => restoreProjectTree(transaction));
    }

    console.log("Restore counts:", counts);
    return counts;
  };

  for (const target of targets) {
    addCounts(totals, await runForProject(target));
  }

  console.log("\nTotal restore counts:", totals);
  return totals;
});

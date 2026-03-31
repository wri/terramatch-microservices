import { withoutSqlLogs } from "@terramatch-microservices/common/util/repl/without-sql-logs";
import {
  Audit,
  Nursery,
  NurseryReport,
  Project,
  ProjectReport,
  Site,
  SiteReport
} from "@terramatch-microservices/database/entities";
import { Op, WhereOptions } from "sequelize";
import { chunk, groupBy } from "lodash";
import { Model, ModelCtor } from "sequelize-typescript";

const EMBEDDED_REPORT_KEYS = ["projectReports", "siteReports", "nurseryReports"] as const;
type EmbeddedReportType = (typeof EMBEDDED_REPORT_KEYS)[number];
type ReportType = EmbeddedReportType;

const REPORT_TYPE_BY_LARAVEL_TYPE: Record<string, ReportType> = {
  [ProjectReport.LARAVEL_TYPE]: "projectReports",
  [SiteReport.LARAVEL_TYPE]: "siteReports",
  [NurseryReport.LARAVEL_TYPE]: "nurseryReports"
};

type CleanupOptions = {
  dryRun?: boolean;
  batchSize?: number;
  fromDate?: string | Date;
  toDate?: string | Date;
  projectUuid?: string;
};

type CleanupTotals = {
  auditsScanned: number;
  auditsUpdated: number;
  kept: number;
  removed: number;
};

type CleanupSummary = Record<ReportType, CleanupTotals>;

type EmbeddedAuditItem = {
  entity_type?: string;
  entity_uuid?: string;
};

const REPORT_MODELS: Record<ReportType, ModelCtor<Model> & { LARAVEL_TYPE: string }> = {
  projectReports: ProjectReport,
  siteReports: SiteReport,
  nurseryReports: NurseryReport
};

const emptySummary = (): CleanupSummary => ({
  projectReports: { auditsScanned: 0, auditsUpdated: 0, kept: 0, removed: 0 },
  siteReports: { auditsScanned: 0, auditsUpdated: 0, kept: 0, removed: 0 },
  nurseryReports: { auditsScanned: 0, auditsUpdated: 0, kept: 0, removed: 0 }
});

const parseDate = (value?: string | Date) => {
  if (value == null) return undefined;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid date value: ${value}`);
  }
  return date;
};

const pruneEmbeddedLogs = (
  payload: unknown,
  entityType: ReportType,
  entityUuid: string
): { changed: boolean; removed: number; kept: number; value: Audit["oldValues"] } => {
  if (payload == null || typeof payload !== "object" || Array.isArray(payload)) {
    return { changed: false, removed: 0, kept: 0, value: payload as Audit["oldValues"] };
  }

  const cloned = { ...(payload as Record<string, unknown>) };
  let changed = false;
  let removed = 0;
  let kept = 0;

  for (const embeddedKey of EMBEDDED_REPORT_KEYS) {
    const embedded = cloned[embeddedKey];
    if (!Array.isArray(embedded)) continue;

    const retained = embedded.filter(item => {
      if (item == null || typeof item !== "object") return false;
      const typedItem = item as EmbeddedAuditItem;
      return typedItem.entity_type === entityType && typedItem.entity_uuid === entityUuid;
    });

    kept += retained.length;
    removed += embedded.length - retained.length;
    if (retained.length !== embedded.length) changed = true;
    cloned[embeddedKey] = retained;
  }

  return { changed, removed, kept, value: cloned as Audit["oldValues"] };
};

async function resolveProjectScopedReportIds(projectUuid: string) {
  const project = await Project.findOne({ where: { uuid: projectUuid }, attributes: ["id"] });
  if (project == null) {
    throw new Error(`Project not found for uuid=${projectUuid}`);
  }

  const projectReports = await ProjectReport.findAll({ where: { projectId: project.id }, attributes: ["id"] });
  const sites = await Site.findAll({ where: { projectId: project.id }, attributes: ["id"] });
  const siteIds = sites.map(({ id }) => id);
  const siteReports =
    siteIds.length === 0
      ? []
      : await SiteReport.findAll({ where: { siteId: { [Op.in]: siteIds } }, attributes: ["id"] });
  const nurseries = await Nursery.findAll({ where: { projectId: project.id }, attributes: ["id"] });
  const nurseryIds = nurseries.map(({ id }) => id);
  const nurseryReports =
    nurseryIds.length === 0
      ? []
      : await NurseryReport.findAll({ where: { nurseryId: { [Op.in]: nurseryIds } }, attributes: ["id"] });

  return {
    [ProjectReport.LARAVEL_TYPE]: projectReports.map(({ id }) => id),
    [SiteReport.LARAVEL_TYPE]: siteReports.map(({ id }) => id),
    [NurseryReport.LARAVEL_TYPE]: nurseryReports.map(({ id }) => id)
  };
}

async function loadUuidsForBatch(audits: Audit[]) {
  const grouped = groupBy(audits, "auditableType");
  const uuidByType = new Map<string, Map<number, string>>();

  for (const [auditableType, typeAudits] of Object.entries(grouped)) {
    const reportType = REPORT_TYPE_BY_LARAVEL_TYPE[auditableType];
    if (reportType == null) continue;
    const ctor = REPORT_MODELS[reportType];
    const ids = typeAudits.map(({ auditableId }) => auditableId);
    const reports = await ctor.findAll({
      where: { id: { [Op.in]: ids } },
      attributes: ["id", "uuid"]
    });
    uuidByType.set(
      auditableType,
      new Map(reports.map(report => [report.get("id") as number, report.get("uuid") as string]))
    );
  }

  return uuidByType;
}

export const cleanupReportAuditLogs = withoutSqlLogs(async (opts: CleanupOptions = {}) => {
  const dryRun = opts.dryRun ?? true;
  const batchSize = opts.batchSize ?? 250;
  const fromDate = parseDate(opts.fromDate);
  const toDate = parseDate(opts.toDate);
  const summary = emptySummary();

  const baseFilters: WhereOptions[] = [
    {
      auditableType: {
        [Op.in]: Object.keys(REPORT_TYPE_BY_LARAVEL_TYPE)
      }
    }
  ];

  if (fromDate != null) {
    baseFilters.push({ [Op.or]: [{ createdAt: { [Op.gte]: fromDate } }, { updatedAt: { [Op.gte]: fromDate } }] });
  }
  if (toDate != null) {
    baseFilters.push({ [Op.or]: [{ createdAt: { [Op.lte]: toDate } }, { updatedAt: { [Op.lte]: toDate } }] });
  }

  const scopedIds = opts.projectUuid != null ? await resolveProjectScopedReportIds(opts.projectUuid) : undefined;
  if (scopedIds != null) {
    baseFilters.push({
      [Op.or]: Object.entries(scopedIds).map(([auditableType, ids]) => ({
        auditableType,
        auditableId: { [Op.in]: ids.length > 0 ? ids : [-1] }
      }))
    });
  }

  let cursor = 0;
  let processed = 0;
  let hasMore = true;

  while (hasMore) {
    const audits = await Audit.findAll({
      where: { [Op.and]: [...baseFilters, { id: { [Op.gt]: cursor } }] },
      order: [["id", "ASC"]],
      limit: batchSize
    });
    if (audits.length === 0) {
      hasMore = false;
      continue;
    }

    cursor = audits[audits.length - 1].id;
    processed += audits.length;

    const uuidsByType = await loadUuidsForBatch(audits);
    const toUpdate: Array<{
      audit: Audit;
      oldValues: Audit["oldValues"];
      newValues: Audit["newValues"];
      entityType: ReportType;
    }> = [];

    for (const audit of audits) {
      const entityType = REPORT_TYPE_BY_LARAVEL_TYPE[audit.auditableType];
      if (entityType == null) continue;

      summary[entityType].auditsScanned += 1;
      const uuid = uuidsByType.get(audit.auditableType)?.get(audit.auditableId);
      if (uuid == null) continue;

      const oldPrune = pruneEmbeddedLogs(audit.oldValues, entityType, uuid);
      const newPrune = pruneEmbeddedLogs(audit.newValues, entityType, uuid);
      summary[entityType].kept += oldPrune.kept + newPrune.kept;
      summary[entityType].removed += oldPrune.removed + newPrune.removed;

      if (oldPrune.changed || newPrune.changed) {
        toUpdate.push({
          audit,
          oldValues: oldPrune.value,
          newValues: newPrune.value,
          entityType
        });
      }
    }

    if (!dryRun && toUpdate.length > 0) {
      const sequelize = Audit.sequelize;
      if (sequelize == null) {
        throw new Error("Audit sequelize instance not available");
      }
      await sequelize.transaction(async transaction => {
        for (const itemChunk of chunk(toUpdate, 50)) {
          await Promise.all(
            itemChunk.map(async ({ audit, oldValues, newValues }) => {
              await Audit.update({ oldValues, newValues }, { where: { id: audit.id }, transaction });
            })
          );
        }
      });
    }

    for (const update of toUpdate) {
      summary[update.entityType].auditsUpdated += 1;
    }
  }

  console.log(`\ncleanup:report-audit-logs ${dryRun ? "[DRY RUN]" : "[EXECUTE]"}`);
  console.log(`Processed audits: ${processed}`);
  console.table(summary);
});

import { withoutSqlLogs } from "@terramatch-microservices/common/util/repl/without-sql-logs";
import { AuditStatus, SitePolygon } from "@terramatch-microservices/database/entities";
import { chunk } from "lodash";
import { Op, Transaction } from "sequelize";

type ReassignPolygonCommentsToBaseOptions = {
  /** Default true. When true, only report what would change. */
  dryRun?: boolean;
};

type ReassignCounts = {
  scanned: number;
  updated: number;
  reassignedToOldestRemaining: number;
  skippedAlreadyOnBase: number;
  skippedMissingVersion: number;
  skippedMissingBase: number;
};

const PAGE_SIZE = 500;

/**
 * Reassigns site-polygon comments from later versions onto the comment anchor:
 * the base polygon (uuid === primaryUuid), or the oldest remaining version if
 * the base no longer exists.
 *
 * Usage:
 *   tm-v3-cli repl entity-service <env> --script "await oneOff.reassignPolygonCommentsToBase({ dryRun: true })"
 *   tm-v3-cli repl entity-service <env> --script "await oneOff.reassignPolygonCommentsToBase({ dryRun: false })"
 */
export const reassignPolygonCommentsToBase = withoutSqlLogs(async (opts: ReassignPolygonCommentsToBaseOptions = {}) => {
  const dryRun = opts.dryRun ?? true;
  const sequelize = AuditStatus.sequelize;
  if (sequelize == null) {
    throw new Error("AuditStatus sequelize instance not available");
  }

  console.log(`\nreassign:polygon-comments-to-base ${dryRun ? "[DRY RUN]" : "[EXECUTE]"}`);

  const run = async (transaction?: Transaction): Promise<ReassignCounts> => {
    const counts: ReassignCounts = {
      scanned: 0,
      updated: 0,
      reassignedToOldestRemaining: 0,
      skippedAlreadyOnBase: 0,
      skippedMissingVersion: 0,
      skippedMissingBase: 0
    };

    let afterId = 0;

    for (;;) {
      const comments = await AuditStatus.findAll({
        where: {
          id: { [Op.gt]: afterId },
          auditableType: SitePolygon.LARAVEL_TYPE,
          type: "comment"
        },
        attributes: ["id", "uuid", "auditableId"],
        order: [["id", "ASC"]],
        limit: PAGE_SIZE,
        transaction
      });

      if (comments.length === 0) {
        break;
      }

      afterId = comments[comments.length - 1].id;
      counts.scanned += comments.length;

      const versionIds = [...new Set(comments.map(comment => comment.auditableId))];
      const versions = await SitePolygon.findAll({
        where: { id: { [Op.in]: versionIds } },
        attributes: ["id", "uuid", "primaryUuid"],
        paranoid: false,
        transaction
      });
      const versionById = new Map(versions.map(version => [version.id, version]));

      const primaryUuids = [...new Set(versions.map(version => version.primaryUuid).filter(uuid => uuid !== ""))];
      const bases =
        primaryUuids.length === 0
          ? []
          : await SitePolygon.findAll({
              where: { uuid: { [Op.in]: primaryUuids } },
              attributes: ["id", "uuid"],
              transaction
            });
      const baseByUuid = new Map(bases.map(base => [base.uuid, base]));

      const missingPrimaryUuids = primaryUuids.filter(uuid => !baseByUuid.has(uuid));
      const oldestRemainingByPrimaryUuid = new Map<string, SitePolygon>();
      if (missingPrimaryUuids.length > 0) {
        const remaining = await SitePolygon.findAll({
          where: { primaryUuid: { [Op.in]: missingPrimaryUuids } },
          attributes: ["id", "uuid", "primaryUuid", "createdAt"],
          order: [
            ["createdAt", "ASC"],
            ["id", "ASC"]
          ],
          transaction
        });
        for (const polygon of remaining) {
          if (!oldestRemainingByPrimaryUuid.has(polygon.primaryUuid)) {
            oldestRemainingByPrimaryUuid.set(polygon.primaryUuid, polygon);
          }
        }
      }

      const idsByAnchorId = new Map<number, number[]>();
      const oldestRemainingAnchorIds = new Set<number>();

      for (const comment of comments) {
        const version = versionById.get(comment.auditableId);
        if (version == null) {
          counts.skippedMissingVersion++;
          continue;
        }

        if (version.uuid === version.primaryUuid) {
          counts.skippedAlreadyOnBase++;
          continue;
        }

        const base = baseByUuid.get(version.primaryUuid);
        const oldestRemaining = oldestRemainingByPrimaryUuid.get(version.primaryUuid);
        const anchor = base ?? oldestRemaining;
        if (anchor == null) {
          counts.skippedMissingBase++;
          continue;
        }

        if (comment.auditableId === anchor.id) {
          counts.skippedAlreadyOnBase++;
          continue;
        }

        const pendingIds = idsByAnchorId.get(anchor.id) ?? [];
        pendingIds.push(comment.id);
        idsByAnchorId.set(anchor.id, pendingIds);
        if (base == null) {
          oldestRemainingAnchorIds.add(anchor.id);
        }
      }

      if (dryRun) {
        for (const [anchorId, ids] of idsByAnchorId) {
          counts.updated += ids.length;
          if (oldestRemainingAnchorIds.has(anchorId)) {
            counts.reassignedToOldestRemaining += ids.length;
          }
        }
        continue;
      }

      for (const [anchorId, ids] of idsByAnchorId) {
        for (const idChunk of chunk(ids, PAGE_SIZE)) {
          await AuditStatus.update({ auditableId: anchorId }, { where: { id: { [Op.in]: idChunk } }, transaction });
          counts.updated += idChunk.length;
          if (oldestRemainingAnchorIds.has(anchorId)) {
            counts.reassignedToOldestRemaining += idChunk.length;
          }
        }
      }
    }

    return counts;
  };

  const results = dryRun ? await run() : await sequelize.transaction(async transaction => run(transaction));

  console.log("reassignPolygonCommentsToBase:", JSON.stringify({ dryRun, ...results }));
  return results;
});

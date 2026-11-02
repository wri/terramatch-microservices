import { withoutSqlLogs } from "@terramatch-microservices/common/util/repl/without-sql-logs";
import { Notification } from "@terramatch-microservices/database/entities";

/**
 * Deletes every row in the notifications table ahead of the new notification system (TM-4076).
 *
 * Run in entity-service REPL:
 *   await oneOff.deleteAllNotifications()
 *   await oneOff.deleteAllNotifications({ dryRun: false })
 *
 * Safe to re-run.
 */
export const deleteAllNotifications = withoutSqlLogs(async (options?: { dryRun?: boolean }) => {
  const dryRun = options?.dryRun !== false;

  if (dryRun) return { dryRun, toDelete: await Notification.count() };

  const deleted = await Notification.destroy({ where: {} });
  return { dryRun, deleted };
});

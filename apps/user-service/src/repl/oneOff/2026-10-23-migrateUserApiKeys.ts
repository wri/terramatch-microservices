import { withoutSqlLogs } from "@terramatch-microservices/common/util/repl/without-sql-logs";
import { ApiKey, User } from "@terramatch-microservices/database/entities";
import { Op } from "sequelize";

/**
 * Moves each user's legacy `users.api_key` into the new `api_keys` table (with no expiration), and
 * clears `users.api_key` (TM-4130). Soft deleted users are included so that the legacy column is
 * fully emptied; ApiKey.findUserId() still refuses keys that belong to deleted users.
 *
 * Run in user-service REPL:
 *   await oneOff.migrateUserApiKeys()
 *   await oneOff.migrateUserApiKeys({ dryRun: false })
 *
 * Safe to re-run.
 */
export const migrateUserApiKeys = withoutSqlLogs(async (options?: { dryRun?: boolean }) => {
  const dryRun = options?.dryRun !== false;

  const users = await User.findAll({
    where: { apiKey: { [Op.ne]: null } },
    attributes: ["id", "apiKey"],
    paranoid: false
  });

  if (dryRun) return { dryRun, toMigrate: users.length };

  await User.sql.transaction(async transaction => {
    await ApiKey.bulkCreate(
      users.map(({ id, apiKey }) => ({ userId: id, key: apiKey as string })),
      { transaction }
    );
    await User.update(
      { apiKey: null },
      { where: { id: users.map(({ id }) => id) }, paranoid: false, silent: true, transaction }
    );
  });

  return { dryRun, migrated: users.length };
});

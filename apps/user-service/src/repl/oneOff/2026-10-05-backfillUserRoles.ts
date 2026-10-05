import { withoutSqlLogs } from "@terramatch-microservices/common/util/repl/without-sql-logs";
import { ModelHasRole, Role, User } from "@terramatch-microservices/database/entities";
import { chunk, groupBy, sortBy } from "lodash";

const CHUNK_SIZE = 1000;

/**
 * Copies each user's role names from the legacy `model_has_roles` join table into the new
 * `users.roles` JSON column. Role names are ordered by role id so that `roles[0]` is stable.
 * Users with no legacy roles are left untouched (`roles` stays null).
 *
 * Users that share the same set of roles are written with a single update per chunk of ids, so
 * the number of statements scales with the number of distinct role sets, not the number of users.
 *
 * Run in user-service REPL:
 *   await oneOff.backfillUserRoles()
 *   await oneOff.backfillUserRoles({ dryRun: false })
 *
 * Safe to re-run.
 */
export const backfillUserRoles = withoutSqlLogs(async (options?: { dryRun?: boolean }) => {
  const dryRun = options?.dryRun !== false;

  const roleNames = new Map((await Role.findAll({ attributes: ["id", "name"] })).map(({ id, name }) => [id, name]));
  const assignments = await ModelHasRole.findAll({
    where: { modelType: User.LARAVEL_TYPE },
    attributes: ["modelId", "roleId"]
  });

  const rolesByUserId = Object.entries(groupBy(assignments, "modelId")).map(([userId, userAssignments]) => ({
    userId: Number(userId),
    roles: sortBy(userAssignments, "roleId").map(({ roleId }) => {
      const name = roleNames.get(roleId);
      if (name == null) throw new Error(`model_has_roles references missing role ${roleId}`);
      return name;
    })
  }));
  const userIdsByRoleSet = groupBy(rolesByUserId, ({ roles }) => JSON.stringify(roles));

  let updated = 0;
  if (!dryRun) {
    for (const [roleSet, users] of Object.entries(userIdsByRoleSet)) {
      const roles = JSON.parse(roleSet) as string[];
      for (const idChunk of chunk(
        users.map(({ userId }) => userId),
        CHUNK_SIZE
      )) {
        const [count] = await User.update({ roles }, { where: { id: idChunk }, paranoid: false, silent: true });
        updated += count;
      }
    }
  }

  const summary = {
    dryRun,
    usersWithRoles: rolesByUserId.length,
    updated,
    roleSets: Object.fromEntries(Object.entries(userIdsByRoleSet).map(([roleSet, users]) => [roleSet, users.length]))
  };
  console.log(JSON.stringify(summary, null, 2));
  return summary;
});

import { withoutSqlLogs } from "@terramatch-microservices/common/util/repl/without-sql-logs";
import { OrganisationUser } from "@terramatch-microservices/database/entities";
import { OrganisationUserStatus, PENDING } from "@terramatch-microservices/database/constants/status";

// The legacy value is, by definition, outside the current OrganisationUserStatus set.
const LEGACY_REQUESTED = "requested" as OrganisationUserStatus;

/**
 * Renames the legacy `requested` organisation_user status to `pending` (TM-4026).
 *
 * Run in user-service REPL:
 *   await oneOff.renameRequestedOrganisationUsers()
 *   await oneOff.renameRequestedOrganisationUsers({ dryRun: false })
 *
 * Safe to re-run.
 */
export const renameRequestedOrganisationUsers = withoutSqlLogs(async (options?: { dryRun?: boolean }) => {
  const dryRun = options?.dryRun !== false;
  const where = { status: LEGACY_REQUESTED };

  if (dryRun) return { dryRun, toUpdate: await OrganisationUser.count({ where }) };

  const [updated] = await OrganisationUser.update({ status: PENDING }, { where });
  return { dryRun, updated };
});

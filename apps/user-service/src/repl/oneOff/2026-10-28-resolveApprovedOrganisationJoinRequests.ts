import { withoutSqlLogs } from "@terramatch-microservices/common/util/repl/without-sql-logs";
import { Organisation, OrganisationJoinRequest, User } from "@terramatch-microservices/database/entities";
import { OrganisationJoinRequestStatus, PENDING } from "@terramatch-microservices/database/constants/status";
import { groupBy } from "lodash";
import { Op } from "sequelize";

// These legacy values are, by definition, outside the current OrganisationJoinRequestStatus set. NULL rows were
// written by the PHP admin "monitoring organisations" field and behaved the same as approved.
const LEGACY_REQUESTED = "requested" as OrganisationJoinRequestStatus;
const LEGACY_APPROVED = "approved" as OrganisationJoinRequestStatus;

// Conflicted users (verified by hand) whose approved organisation replaces their current home organisation. All
// other conflicted users keep their home organisation.
const MOVE_TO_APPROVED_ORG_USER_IDS = [2023, 3812];

/**
 * Organisation membership now lives only on users.organisation_id, and organisation_join_requests only holds
 * pending and rejected requests. This one-off converts the rows left over from organisation_user:
 *  - `requested` rows become `pending` (in case renameRequestedOrganisationUsers was never run).
 *  - Each approved (or NULL status) row moves to users.organisation_id when the user has no organisation and
 *    that row is their only approved one. Rows for users who already belong to a different organisation (or
 *    have several approved rows) are reported in `conflicts` with the resolution applied: users listed in
 *    MOVE_TO_APPROVED_ORG_USER_IDS move to their approved organisation, everyone else keeps their home
 *    organisation. Deleted users are left as they are and not reported.
 *  - All approved (or NULL status) rows are then deleted.
 *
 * Run in user-service REPL:
 *   await oneOff.resolveApprovedOrganisationJoinRequests()
 *   await oneOff.resolveApprovedOrganisationJoinRequests({ dryRun: false })
 *
 * Safe to re-run.
 */
export const resolveApprovedOrganisationJoinRequests = withoutSqlLogs(async (options?: { dryRun?: boolean }) => {
  const dryRun = options?.dryRun !== false;

  const approvedWhere = { [Op.or]: [{ status: LEGACY_APPROVED }, { status: null }] };
  const approved = await OrganisationJoinRequest.findAll({
    where: approvedWhere,
    attributes: ["id", "userId", "organisationId"]
  });
  const users = await User.findAll({
    where: { id: { [Op.in]: approved.map(({ userId }) => userId) } },
    attributes: ["id", "uuid", "emailAddress", "roles", "organisationId", "deletedAt"],
    paranoid: false
  });
  const usersById = new Map(users.map(user => [user.id, user]));

  const toBackfill: { userId: number; organisationId: number }[] = [];
  const conflictIds: { userId: number; homeOrganisationId: number | null; approvedOrganisationIds: number[] }[] = [];
  for (const rows of Object.values(groupBy(approved, "userId"))) {
    const userId = rows[0].userId;
    const homeOrganisationId = usersById.get(userId)?.organisationId ?? null;
    const approvedOrganisationIds = rows
      .map(({ organisationId }) => organisationId)
      .filter(organisationId => organisationId !== homeOrganisationId);
    if (approvedOrganisationIds.length === 0) continue;

    if (homeOrganisationId == null && approvedOrganisationIds.length === 1) {
      toBackfill.push({ userId, organisationId: approvedOrganisationIds[0] });
    } else if (usersById.get(userId)?.isSoftDeleted() !== true) {
      conflictIds.push({ userId, homeOrganisationId, approvedOrganisationIds });
    }
  }

  const organisations = await Organisation.findAll({
    where: {
      id: {
        [Op.in]: conflictIds.flatMap(({ homeOrganisationId, approvedOrganisationIds }) =>
          homeOrganisationId == null ? approvedOrganisationIds : [homeOrganisationId, ...approvedOrganisationIds]
        )
      }
    },
    attributes: ["id", "uuid", "name"],
    paranoid: false
  });
  const organisationsById = new Map(organisations.map(organisation => [organisation.id, organisation]));
  const orgLabel = (id: number) => {
    const organisation = organisationsById.get(id);
    return organisation == null ? `${id} (missing)` : `${id} ${organisation.name} (${organisation.uuid})`;
  };
  const toMove: { userId: number; organisationId: number }[] = [];
  // Flattened to strings so the REPL prints every value instead of collapsing nested arrays to [Array].
  const conflicts = conflictIds.map(({ userId, homeOrganisationId, approvedOrganisationIds }) => {
    let resolution = "keep home organisation";
    if (MOVE_TO_APPROVED_ORG_USER_IDS.includes(userId)) {
      if (approvedOrganisationIds.length === 1) {
        toMove.push({ userId, organisationId: approvedOrganisationIds[0] });
        resolution = `move to ${orgLabel(approvedOrganisationIds[0])}`;
      } else {
        resolution = "keep home organisation (move requested, but there are several approved organisations)";
      }
    }
    return {
      userId,
      userUuid: usersById.get(userId)?.uuid ?? "missing",
      userEmail: usersById.get(userId)?.emailAddress ?? "missing",
      userRoles: usersById.get(userId)?.roles.join(", ") ?? "missing",
      homeOrganisation: homeOrganisationId == null ? "none" : orgLabel(homeOrganisationId),
      approvedOrganisations: approvedOrganisationIds.map(orgLabel).join(", "),
      resolution
    };
  });

  const requestedWhere = { status: LEGACY_REQUESTED };
  if (dryRun) {
    return {
      dryRun,
      requestedToRename: await OrganisationJoinRequest.count({ where: requestedWhere }),
      approvedToDelete: approved.length,
      toBackfill,
      toMove,
      conflicts
    };
  }

  await User.sql.transaction(async transaction => {
    await OrganisationJoinRequest.update({ status: PENDING }, { where: requestedWhere, transaction });
    for (const { userId, organisationId } of [...toBackfill, ...toMove]) {
      await User.update({ organisationId }, { where: { id: userId }, paranoid: false, transaction });
    }
    await OrganisationJoinRequest.destroy({ where: approvedWhere, transaction });
  });

  return { dryRun, approvedDeleted: approved.length, backfilled: toBackfill, moved: toMove, conflicts };
});

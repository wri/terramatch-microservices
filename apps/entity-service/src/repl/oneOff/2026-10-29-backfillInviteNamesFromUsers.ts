import { withoutSqlLogs } from "@terramatch-microservices/common/util/repl/without-sql-logs";
import { OrganisationInvite, ProjectInvite, User } from "@terramatch-microservices/database/entities";
import { chunk } from "lodash";
import { Op } from "sequelize";

const CHUNK_SIZE = 1000;

type InviteRow = {
  id: number;
  emailAddress: string | null;
  firstName: string | null;
  lastName: string | null;
};

type InviteNameValues = { firstName?: string | null; lastName?: string | null };

type Bucket = {
  found: number;
  updated: number;
};

const backfillInvites = async (
  invites: InviteRow[],
  updateInvites: (values: InviteNameValues, ids: number[]) => Promise<unknown>,
  dryRun: boolean
): Promise<Bucket> => {
  const bucket: Bucket = { found: invites.length, updated: 0 };

  const invitesByEmail = new Map<string, InviteRow[]>();
  for (const invite of invites) {
    if (invite.emailAddress == null) continue;
    const emailInvites = invitesByEmail.get(invite.emailAddress) ?? [];
    emailInvites.push(invite);
    invitesByEmail.set(invite.emailAddress, emailInvites);
  }

  const changedIds = new Set<number>();
  for (const emailChunk of chunk([...invitesByEmail.keys()], CHUNK_SIZE)) {
    const users = await User.findAll({
      where: { emailAddress: { [Op.in]: emailChunk } },
      attributes: ["emailAddress", "firstName", "lastName"]
    });

    for (const user of users) {
      const emailInvites = invitesByEmail.get(user.emailAddress as string) ?? [];
      const firstNameIds = user.firstName == null ? [] : emailInvites.filter(i => i.firstName == null).map(i => i.id);
      const lastNameIds = user.lastName == null ? [] : emailInvites.filter(i => i.lastName == null).map(i => i.id);

      if (!dryRun && firstNameIds.length > 0) {
        await updateInvites({ firstName: user.firstName }, firstNameIds);
      }
      if (!dryRun && lastNameIds.length > 0) {
        await updateInvites({ lastName: user.lastName }, lastNameIds);
      }

      [...firstNameIds, ...lastNameIds].forEach(id => changedIds.add(id));
    }
  }
  bucket.updated = changedIds.size;

  return bucket;
};

/**
 * Copies first_name / last_name from the users table onto organisation and project invites that are missing
 * them, matching on email_address. Only empty invite columns are filled; existing invite names are never changed.
 *
 * Run in entity-service REPL:
 *   await oneOff.backfillInviteNamesFromUsers()
 *   await oneOff.backfillInviteNamesFromUsers({ dryRun: false })
 *
 * Safe to re-run.
 */
export const backfillInviteNamesFromUsers = withoutSqlLogs(async (options?: { dryRun?: boolean }) => {
  const dryRun = options?.dryRun !== false;
  const missingNameWhere = { [Op.or]: [{ firstName: null }, { lastName: null }] };

  const organisationInvites = await OrganisationInvite.findAll({
    where: missingNameWhere,
    attributes: ["id", "emailAddress", "firstName", "lastName"]
  });
  const organisationResult = await backfillInvites(
    organisationInvites,
    (values, ids) => OrganisationInvite.update(values, { where: { id: ids } }),
    dryRun
  );

  const projectInvites = await ProjectInvite.findAll({
    where: missingNameWhere,
    attributes: ["id", "emailAddress", "firstName", "lastName"]
  });
  const projectResult = await backfillInvites(
    projectInvites,
    (values, ids) => ProjectInvite.update(values, { where: { id: ids } }),
    dryRun
  );

  return { dryRun, organisationInvites: organisationResult, projectInvites: projectResult };
});

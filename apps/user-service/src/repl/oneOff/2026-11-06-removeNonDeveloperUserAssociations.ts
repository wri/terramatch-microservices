import { withoutSqlLogs } from "@terramatch-microservices/common/util/repl/without-sql-logs";
import { OrganisationJoinRequest, ProjectUser, User } from "@terramatch-microservices/database/entities";
import { Subquery } from "@terramatch-microservices/database/util/subquery.builder";
import { col, fn, Op, where } from "sequelize";
import { Literal } from "sequelize/types/utils";

const lacksRole = (role: string) => where(fn("JSON_CONTAINS", col("roles"), JSON.stringify(role)), 0);

// Soft deleted users are excluded by the User paranoid default.
const findUsers = (userIdSubquery: Literal, excludedRoles: string[]) =>
  User.findAll({
    where: {
      id: { [Op.in]: userIdSubquery },
      [Op.and]: excludedRoles.map(lacksRole)
    },
    attributes: ["id", "emailAddress", "roles"]
  });

// Flattened to strings so the REPL prints every value instead of collapsing nested arrays to [Array].
const describeUsers = (users: User[]) =>
  users.map(({ id, emailAddress, roles }) => `${id} ${emailAddress} [${roles.join(", ")}]`);

/**
 * Removes association rows for users whose roles no longer warrant them:
 *  - v2_project_users (monitoring partner / project associations) for users that are neither project developers
 *    nor project managers.
 *  - organisation_join_requests for users that are not project developers.
 *
 * Soft deleted users are left as they are.
 *
 * Run in user-service REPL:
 *   await oneOff.removeNonDeveloperUserAssociations()
 *   await oneOff.removeNonDeveloperUserAssociations({ dryRun: false })
 *
 * Safe to re-run.
 */
export const removeNonDeveloperUserAssociations = withoutSqlLogs(async (options?: { dryRun?: boolean }) => {
  const dryRun = options?.dryRun !== false;

  const projectUsers = await findUsers(Subquery.select(ProjectUser, "userId").literal, [
    "project-developer",
    "project-manager"
  ]);
  const projectUserWhere = { userId: { [Op.in]: projectUsers.map(({ id }) => id) } };
  const joinRequestUsers = await findUsers(Subquery.select(OrganisationJoinRequest, "userId").literal, [
    "project-developer"
  ]);
  const joinRequestWhere = { userId: { [Op.in]: joinRequestUsers.map(({ id }) => id) } };

  return {
    dryRun,
    projectUsers: {
      removed: dryRun
        ? await ProjectUser.count({ where: projectUserWhere })
        : await ProjectUser.destroy({ where: projectUserWhere }),
      users: describeUsers(projectUsers)
    },
    organisationJoinRequests: {
      removed: dryRun
        ? await OrganisationJoinRequest.count({ where: joinRequestWhere })
        : await OrganisationJoinRequest.destroy({ where: joinRequestWhere }),
      users: describeUsers(joinRequestUsers)
    }
  };
});

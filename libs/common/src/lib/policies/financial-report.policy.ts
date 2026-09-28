import { UserPermissionsPolicy } from "./user-permissions.policy";
import { FinancialReport, Project, ProjectUser, User } from "@terramatch-microservices/database/entities";
import { PENDING_APPROVAL, DUE, DRAFT } from "@terramatch-microservices/database/constants/status";
import { Op } from "sequelize";

export const monitoredOrganisationIds = (user: User | null | undefined) =>
  (user?.projects ?? []).flatMap(project =>
    project.ProjectUser?.isMonitoring === true && project.organisationId != null ? [project.organisationId] : []
  );

/**
 * Organisations whose financial reports this user may read: monitored projects, their own
 * organisation, and the organisations already listed by the project index. Project organisation
 * ids come from a subquery because selecting `organisationId` on the user-projects association
 * drops that column.
 */
export async function readableFinancialReportOrganisationIds(
  userId: number,
  permissions: readonly string[] | undefined,
  preloadedUser?: User | null
): Promise<number[]> {
  const user =
    preloadedUser !== undefined
      ? preloadedUser
      : await User.findOne({
          where: { id: userId },
          attributes: ["id", "organisationId"],
          include: [
            { association: "roles", attributes: ["name"] },
            {
              association: "projects",
              attributes: ["organisationId"],
              through: { attributes: ["isMonitoring"] }
            }
          ]
        });

  const organisationIds = new Set<number>();
  for (const organisationId of monitoredOrganisationIds(user)) {
    organisationIds.add(Number(organisationId));
  }

  const includeOwnOrganisation =
    user?.primaryRole === "project-manager" || permissions?.includes("manage-own") === true;
  if (includeOwnOrganisation && user?.organisationId != null) {
    organisationIds.add(Number(user.organisationId));
  }

  const projectIds = permissions?.includes("manage-own")
    ? ProjectUser.userProjectsSubquery(userId)
    : permissions?.includes("projects-manage")
      ? ProjectUser.projectsManageSubquery(userId)
      : null;
  if (projectIds != null) {
    const projects = await Project.findAll({
      attributes: ["organisationId"],
      where: { id: { [Op.in]: projectIds } }
    });
    for (const project of projects) {
      if (project.organisationId != null) organisationIds.add(Number(project.organisationId));
    }
  }

  return [...organisationIds];
}

export class FinancialReportPolicy extends UserPermissionsPolicy {
  async addRules() {
    if (this.frameworks.length > 0) {
      this.builder.can(
        ["read", "delete", "update", "approve", "updateAnswers", "sendReminder", "export"],
        FinancialReport,
        {
          frameworkKey: { $in: this.frameworks }
        }
      );
    }

    const user = await this.getUser();
    if (user != null) {
      this.builder.can(["read", "delete", "update", "approve"], FinancialReport, {
        organisationId: user.organisationId
      });
      this.builder.can("updateAnswers", FinancialReport, {
        organisationId: user.organisationId,
        status: { $in: [DRAFT, DUE] }
      });
      this.builder.can("updateAnswers", FinancialReport, {
        organisationId: user.organisationId,
        status: PENDING_APPROVAL,
        nothingToReport: true
      });
    }

    if (this.permissions.includes("reports-manage")) {
      this.builder.can(["read", "delete", "update", "approve", "updateAnswers", "sendReminder"], FinancialReport);
    }

    const organisationIds = await readableFinancialReportOrganisationIds(this.userId, this.permissions, user);
    if (organisationIds.length > 0) {
      this.builder.can("read", FinancialReport, { organisationId: { $in: organisationIds } });
    }
  }

  private _user?: User | null;
  private async getUser() {
    if (this._user != null) return this._user;

    return (this._user = await User.findOne({
      where: { id: this.userId },
      attributes: ["id", "organisationId"],
      include: [
        {
          association: "projects",
          attributes: ["organisationId"],
          through: { attributes: ["isMonitoring"] }
        },
        { association: "roles", attributes: ["name"] }
      ]
    }));
  }
}

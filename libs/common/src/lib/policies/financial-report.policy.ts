import { UserPermissionsPolicy } from "./user-permissions.policy";
import { FinancialReport, User } from "@terramatch-microservices/database/entities";
import { PENDING_APPROVAL, DUE, DRAFT } from "@terramatch-microservices/database/constants/status";

export const monitoredOrganisationIds = (user: User | null | undefined) =>
  (user?.projects ?? []).flatMap(project =>
    project.ProjectUser?.isMonitoring === true && project.organisationId != null ? [project.organisationId] : []
  );

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

    const organisationIds: number[] = [];
    if (this.permissions?.includes("projects-manage")) {
      const projectsOrganisationIds = [...((user?.projects ?? []).map(({ organisationId }) => organisationId) ?? [])];
      if (projectsOrganisationIds.length > 0) {
        organisationIds.push(...projectsOrganisationIds.filter((id): id is number => id !== null));
      }
    }
    if (user?.primaryRole === "project-manager" && user.organisationId != null) {
      organisationIds.push(user.organisationId as number);
    }
    organisationIds.push(...monitoredOrganisationIds(user));
    if (organisationIds.length > 0) {
      this.builder.can("read", FinancialReport, { organisationId: { $in: organisationIds } });
    }
  }

  private _user?: User | null;
  private async getUser() {
    if (this._user != null) return this._user;

    return (this._user = await User.findOne({
      where: { id: this.userId },
      attributes: ["id", "organisationId", "roles"],
      include: [
        {
          association: "projects",
          attributes: ["organisationId"],
          through: { attributes: ["isMonitoring"] }
        }
      ]
    }));
  }
}

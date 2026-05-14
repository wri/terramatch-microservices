import { UserPermissionsPolicy } from "./user-permissions.policy";
import { FinancialReport, User } from "@terramatch-microservices/database/entities";
import { AWAITING_APPROVAL, DUE, STARTED } from "@terramatch-microservices/database/constants/status";

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
        status: { $in: [STARTED, DUE] }
      });
      this.builder.can("updateAnswers", FinancialReport, {
        organisationId: user.organisationId,
        status: AWAITING_APPROVAL,
        nothingToReport: true
      });
    }

    if (this.permissions.includes("reports-manage")) {
      this.builder.can(["read", "delete", "update", "approve", "updateAnswers", "sendReminder"], FinancialReport);
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
        { association: "projects", attributes: ["organisationId"] },
        { association: "roles", attributes: ["name"] }
      ]
    }));
  }
}

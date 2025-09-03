import { UserPermissionsPolicy } from "./user-permissions.policy";
import { FinancialReport, User } from "@terramatch-microservices/database/entities";

export class FinancialReportPolicy extends UserPermissionsPolicy {
  async addRules() {
    if (this.frameworks.length > 0) {
      this.builder.can(["read", "delete", "update", "approve"], FinancialReport, {
        frameworkKey: { $in: this.frameworks }
      });
    }

    if (this.permissions.includes("manage-own")) {
      const user = await this.getUser();
      if (user != null) {
        this.builder.can(["read", "delete", "update", "approve"], FinancialReport, {
          organisationId: user.organisationId
        });
      }
    }

    if (this.permissions.includes("reports-manage")) {
      this.builder.can(["read", "delete", "update", "approve"], FinancialReport);
    }
  }

  private _user?: User | null;
  private async getUser() {
    if (this._user != null) return this._user;

    return (this._user = await User.findOne({
      where: { id: this.userId },
      attributes: ["id", "organisationId"]
    }));
  }
}

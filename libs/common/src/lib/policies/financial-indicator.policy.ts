import { UserPermissionsPolicy } from "./user-permissions.policy";

import { FinancialIndicator, User } from "@terramatch-microservices/database/entities";

export class FinancialIndicatorPolicy extends UserPermissionsPolicy {
  async addRules() {
    const user = await this.getUser();
    if (user?.organisationId != null) {
      this.builder.can(["uploadFiles", "deleteFiles"], FinancialIndicator, {
        organisationId: user.organisationId
      });
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

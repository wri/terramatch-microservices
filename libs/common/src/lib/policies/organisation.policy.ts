import { UserPermissionsPolicy } from "./user-permissions.policy";

import { Organisation, User } from "@terramatch-microservices/database/entities";

export class OrganisationPolicy extends UserPermissionsPolicy {
  async addRules() {
    const user = await this.getUser();
    if (user != null) {
      this.builder.can("uploadFiles", Organisation, { id: user.organisationId, status: "approved" });
    }
  }

  private _user?: User | null;
  private async getUser() {
    if (this._user != null) return this._user;

    return (this._user = await User.findOne({
      where: { id: this.userId },
      attributes: ["organisationId", "status"]
    }));
  }
}

import { UserPermissionsPolicy } from "./user-permissions.policy";

import { Organisation, User } from "@terramatch-microservices/database/entities";

export class OrganisationPolicy extends UserPermissionsPolicy {
  async addRules() {
    if (this.frameworks.length > 0) {
      this.builder.can(["read"], Organisation);
    }

    if (this.permissions.includes("users-manage")) {
      this.builder.can(["create", "uploadFiles", "deleteFiles", "updateFiles"], Organisation);
    }

    if (this.permissions.includes("manage-own")) {
      const primaryOrg = await this.getPrimaryOrganisation();
      if (primaryOrg != null) {
        this.builder.can(["uploadFiles", "deleteFiles", "updateFiles"], Organisation, { id: primaryOrg.id });
      }
    }
  }

  protected _primaryOrg?: Organisation | null;
  protected async getPrimaryOrganisation() {
    if (this._primaryOrg != null) return this._primaryOrg;

    const user = await User.findOne({
      where: { id: this.userId },
      attributes: ["organisationId", "id"]
    });
    return (this._primaryOrg = await user?.primaryOrganisation());
  }
}

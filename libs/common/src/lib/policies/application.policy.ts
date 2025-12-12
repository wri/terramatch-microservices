import { Application } from "@terramatch-microservices/database/entities";
import { UserPermissionsPolicy } from "./user-permissions.policy";

export class ApplicationPolicy extends UserPermissionsPolicy {
  async addRules() {
    if (this.frameworks.length > 0) {
      this.builder.can(["read"], Application);
    }

    if (this.permissions.includes("manage-own")) {
      const orgUuids = await this.getOrgUuids();
      this.builder.can("read", Application, { organisationUuid: { $in: orgUuids } });
    }
  }
}

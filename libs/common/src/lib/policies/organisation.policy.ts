import { UserPermissionsPolicy } from "./user-permissions.policy";

import { Organisation } from "@terramatch-microservices/database/entities";

export class OrganisationPolicy extends UserPermissionsPolicy {
  async addRules() {
    if (this.permissions.includes("users-manage")) {
      this.builder.can("create", Organisation);
    }
  }
}

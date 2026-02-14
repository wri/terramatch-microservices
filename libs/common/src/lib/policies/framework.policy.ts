import { UserPermissionsPolicy } from "./user-permissions.policy";
import { Framework } from "@terramatch-microservices/database/entities";

export class FrameworkPolicy extends UserPermissionsPolicy {
  async addRules() {
    this.builder.can("read", Framework);

    if (this.frameworks.length > 0) {
      this.builder.can(["read", "update", "create", "delete"], Framework);
    }
  }
}

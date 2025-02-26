import { User } from "@terramatch-microservices/database/entities";
import { UserPermissionsPolicy } from "./user-permissions.policy";

export class UserPolicy extends UserPermissionsPolicy {
  async addRules() {
    if (this.permissions.includes("users-manage")) {
      this.builder.can("read", User);
      this.builder.can("update", User);
    } else {
      this.builder.can("read", User, { id: this.userId });
      this.builder.can("update", User, { id: this.userId });
    }
  }
}

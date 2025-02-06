import { User } from "@terramatch-microservices/database/entities";
import { EntityPolicy } from "./entity.policy";

export class UserPolicy extends EntityPolicy {
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

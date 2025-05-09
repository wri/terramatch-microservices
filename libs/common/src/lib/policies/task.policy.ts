import { UserPermissionsPolicy } from "./user-permissions.policy";
import { Task } from "@terramatch-microservices/database/entities";

export class TaskPolicy extends UserPermissionsPolicy {
  async addRules() {
    if (this.permissions.includes("projects-manage") || this.frameworks.length > 0) {
      this.builder.can("read", Task);
    }
  }
}

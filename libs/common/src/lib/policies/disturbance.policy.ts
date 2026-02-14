import { Disturbance } from "@terramatch-microservices/database/entities";
import { UserPermissionsPolicy } from "./user-permissions.policy";

export class DisturbancePolicy extends UserPermissionsPolicy {
  async addRules() {
    if (this.frameworks.length > 0) {
      this.builder.can("read", Disturbance);
    }
  }
}

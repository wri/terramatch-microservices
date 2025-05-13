import { ProjectPitch } from "@terramatch-microservices/database/entities";
import { UserPermissionsPolicy } from "./user-permissions.policy";

export class ProjectPitchPolicy extends UserPermissionsPolicy {
  async addRules() {
    if (this.permissions.some(permission => permission.startsWith("framework-"))) {
      this.builder.can("read", ProjectPitch);
      return;
    }
  }
}

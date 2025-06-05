import { ImpactStory } from "@terramatch-microservices/database/entities";
import { UserPermissionsPolicy } from "./user-permissions.policy";

export class ImpactStoryPolicy extends UserPermissionsPolicy {
  async addRules() {
    if (this.frameworks.length > 0) {
      this.builder.can("read", ImpactStory);
      return;
    }
  }
}

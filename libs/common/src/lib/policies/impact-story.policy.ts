import { UserPermissionsPolicy } from "./user-permissions.policy";
import { ImpactStory } from "@terramatch-microservices/database/entities";

export class ImpactStoryPolicy extends UserPermissionsPolicy {
  async addRules() {
    if (this.frameworks.length > 0) {
      this.builder.can("uploadFiles", ImpactStory);
    }
  }
}

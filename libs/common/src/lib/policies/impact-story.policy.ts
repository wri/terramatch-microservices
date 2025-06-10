import { UserPermissionsPolicy } from "./user-permissions.policy";
import { ImpactStory } from "@terramatch-microservices/database/entities";

export class ImpactStoryPolicy extends UserPermissionsPolicy {
  async addRules() {
    if (this.frameworks.length > 0 || this.permissions.includes("impact-stories-manage")) {
      this.builder.can("uploadFiles", ImpactStory);
    }
  }
}

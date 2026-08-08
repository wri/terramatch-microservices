import { UserPermissionsPolicy } from "./user-permissions.policy";
import { AboutSection } from "@terramatch-microservices/database/entities";

export class AboutSectionPolicy extends UserPermissionsPolicy {
  async addRules() {
    // if a user can manage custom forms, they can also manage about sections
    if (this.permissions.includes("custom-forms-manage")) {
      this.builder.can(["delete", "create", "update"], AboutSection);
    }
  }
}

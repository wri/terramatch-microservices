import { UserPermissionsPolicy } from "./user-permissions.policy";
import { LocalizationKey } from "@terramatch-microservices/database/entities";

export class LocalizationKeyPolicy extends UserPermissionsPolicy {
  async addRules() {
    if (this.permissions.includes("custom-forms-manage")) {
      this.builder.can(["update"], LocalizationKey);
    }
  }
}

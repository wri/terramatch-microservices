import { Media } from "@terramatch-microservices/database/entities";
import { UserPermissionsPolicy } from "./user-permissions.policy";

export class MediaPolicy extends UserPermissionsPolicy {
  async addRules() {
    if (!this.permissions.includes("media-manage")) {
      this.builder.cannot("bulkDelete", Media);
      return;
    }

    this.builder.can("bulkDelete", Media, { createdBy: this.userId });
  }
}

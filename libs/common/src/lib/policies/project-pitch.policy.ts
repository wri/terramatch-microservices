import { ProjectPitch } from "@terramatch-microservices/database/entities";
import { UserPermissionsPolicy } from "./user-permissions.policy";

export class ProjectPitchPolicy extends UserPermissionsPolicy {
  async addRules() {
    if (this.frameworks.length > 0) {
      this.builder.can(["read", "uploadFiles", "deleteFiles", "updateFiles"], ProjectPitch);
    }

    if (this.permissions.includes("manage-own")) {
      const orgUuid = await this.getOrgUuid();
      if (orgUuid != null) {
        this.builder.can(["read", "update", "uploadFiles", "deleteFiles", "updateFiles"], ProjectPitch, {
          organisationId: orgUuid
        });
      }
    }
  }
}

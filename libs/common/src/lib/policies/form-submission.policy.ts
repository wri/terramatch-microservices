import { FormSubmission } from "@terramatch-microservices/database/entities";
import { UserPermissionsPolicy } from "./user-permissions.policy";

export class FormSubmissionPolicy extends UserPermissionsPolicy {
  async addRules() {
    if (this.frameworks.length > 0) {
      this.builder.can(["read"], FormSubmission);
    }

    if (this.permissions.includes("manage-own")) {
      const orgUuids = await this.getOrgUuids();
      this.builder.can("read", FormSubmission, { organisationUuid: { $in: orgUuids } });
    }
  }
}

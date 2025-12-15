import { UserPermissionsPolicy } from "./user-permissions.policy";

import { FundingProgramme } from "@terramatch-microservices/database/entities";

export class FundingProgrammePolicy extends UserPermissionsPolicy {
  async addRules() {
    // Funding programme read is unrestricted
    this.builder.can(["read"], FundingProgramme);

    if (this.frameworks.length > 0) {
      this.builder.can(["uploadFiles", "delete"], FundingProgramme, { frameworkKey: { $in: this.frameworks } });
    }
  }
}

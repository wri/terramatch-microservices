import { UserPermissionsPolicy } from "./user-permissions.policy";

import { FundingProgramme } from "@terramatch-microservices/database/entities";

export class FundingProgrammePolicy extends UserPermissionsPolicy {
  async addRules() {
    if (this.frameworks.length > 0) {
      this.builder.can(["uploadFiles"], FundingProgramme, { frameworkKey: { $in: this.frameworks } });
    }
  }
}

import { UserPermissionsPolicy } from "./user-permissions.policy";

import { FormQuestionOption } from "@terramatch-microservices/database/entities";

export class FormQuestionOptionPolicy extends UserPermissionsPolicy {
  async addRules() {
    if (this.frameworks.length > 0) {
      // check if FormQuestion is in the framework
      //   this.builder.can(["uploadFiles"], FormQuestionOption, { frameworkKey: { $in: this.frameworks } });
    }
  }
}

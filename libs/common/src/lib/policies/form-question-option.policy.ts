import { UserPermissionsPolicy } from "./user-permissions.policy";

import { FormQuestionOption } from "@terramatch-microservices/database/entities";

export class FormQuestionOptionPolicy extends UserPermissionsPolicy {
  async addRules() {
    // TODO: implement this policy
    this.builder.can(["uploadFiles"], FormQuestionOption);
  }
}

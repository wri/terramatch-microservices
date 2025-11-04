import { UserPermissionsPolicy } from "./user-permissions.policy";
import { FormQuestionOption } from "@terramatch-microservices/database/entities";

export class FormQuestionOptionPolicy extends UserPermissionsPolicy {
  async addRules() {
    if (this.permissions.includes("custom-forms-manage")) {
      this.builder.can(["uploadFiles"], FormQuestionOption);
    }
  }
}

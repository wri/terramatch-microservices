import { UserPermissionsPolicy } from "./user-permissions.policy";

import { Form } from "@terramatch-microservices/database/entities";

export class FormPolicy extends UserPermissionsPolicy {
  async addRules() {
    // TODO: implement this policy
    this.builder.can(["uploadFiles"], Form);
  }
}

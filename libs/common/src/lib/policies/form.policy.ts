import { UserPermissionsPolicy } from "./user-permissions.policy";
import { Form } from "@terramatch-microservices/database/entities";

export class FormPolicy extends UserPermissionsPolicy {
  async addRules() {
    if (this.permissions.includes("custom-forms-manage")) {
      this.builder.can(["uploadFiles", "delete"], Form);
    }
  }
}

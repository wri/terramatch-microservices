import { UserPermissionsPolicy } from "./user-permissions.policy";
import { Form } from "@terramatch-microservices/database/entities";

export class FormPolicy extends UserPermissionsPolicy {
  async addRules() {
    if (this.frameworks?.length > 0) {
      this.builder.can(["uploadFiles"], Form, {
        frameworkKey: { $in: this.frameworks ?? null }
      });
    }
  }
}

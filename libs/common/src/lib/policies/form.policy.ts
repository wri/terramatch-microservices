import { UserPermissionsPolicy } from "./user-permissions.policy";
import { Form, User } from "@terramatch-microservices/database/entities";

export class FormPolicy extends UserPermissionsPolicy {
  async addRules() {
    if (this.frameworks.length > 0) {
      this.builder.can(["read", "update", "delete", "uploadFiles"], Form, {
        frameworkKey: { $in: this.frameworks }
      });
    }

    if (this.permissions.includes("forms-manage")) {
      this.builder.can(["read", "create", "update", "delete", "uploadFiles"], Form);
    }

    const user = await this.getUser();
    if (user != null) {
      this.builder.can(["read", "update", "uploadFiles"], Form, { updatedBy: user.id });
    }
  }

  protected _user?: User | null;
  protected async getUser() {
    if (this._user != null) return this._user;

    return (this._user = await User.findOne({
      where: { id: this.userId },
      attributes: ["id"]
    }));
  }
}

import { UserPermissionsPolicy } from "./user-permissions.policy";
import { Form, User } from "@terramatch-microservices/database/entities";

export class FormPolicy extends UserPermissionsPolicy {
  async addRules() {
    if (this.frameworks?.length > 0) {
      this.builder.can(["uploadFiles"], Form, {
        frameworkKey: { $in: this.frameworks }
      });
    }
  }

  protected _user?: User | null;
  protected async getUser() {
    if (this._user != null) return this._user;

    return (this._user = await User.findOne({
      where: { id: this.userId },
      attributes: ["uuid"]
    }));
  }
}

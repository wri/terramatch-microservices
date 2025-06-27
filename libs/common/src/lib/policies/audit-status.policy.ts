import { AuditStatus } from "@terramatch-microservices/database/entities/audit-status.entity";
import { UserPermissionsPolicy } from "./user-permissions.policy";
import { User } from "@terramatch-microservices/database/entities";

export class AuditStatusPolicy extends UserPermissionsPolicy {
  async addRules() {
    const user = await this.getUser();

    if (user != null) {
      this.builder.can("uploadFiles", AuditStatus, { createdBy: user.emailAddress });
    }
  }

  protected _user?: User | null;
  protected async getUser() {
    if (this._user != null) return this._user;

    return (this._user = await User.findOne({
      where: { id: this.userId },
      attributes: ["id", "emailAddress"]
    }));
  }
}

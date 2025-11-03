import { Media, User } from "@terramatch-microservices/database/entities";
import { UserPermissionsPolicy } from "./user-permissions.policy";

export class MediaPolicy extends UserPermissionsPolicy {
  async addRules() {
    if (!this.permissions.includes("media-manage")) {
      this.builder.cannot("bulkDelete", Media);
    }

    this.builder.can("bulkDelete", Media, { createdBy: this.userId });
  }

  protected _user?: User | null;
  protected async getUser() {
    if (this._user != null) return this._user;

    return (this._user = await User.findOne({
      where: { id: this.userId }
    }));
  }
}

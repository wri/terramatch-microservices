import { Organisation, ProjectPitch, User } from "@terramatch-microservices/database/entities";
import { UserPermissionsPolicy } from "./user-permissions.policy";

export class ProjectPitchPolicy extends UserPermissionsPolicy {
  async addRules() {
    if (this.frameworks.length > 0) {
      this.builder.can(["read", "uploadFiles", "deleteFiles", "updateFiles"], ProjectPitch);
      return;
    }

    if (this.permissions.includes("manage-own")) {
      const user = await this.getUser();
      if (user?.organisationId != null) {
        const orgUuid = (await Organisation.findOne({ where: { id: user.organisationId }, attributes: ["uuid"] }))
          ?.uuid;
        this.builder.can(["read", "update", "uploadFiles", "deleteFiles", "updateFiles"], ProjectPitch, {
          organisationId: orgUuid
        });
      }
    }
  }

  protected _user?: User | null;
  protected async getUser() {
    if (this._user != null) return this._user;

    return (this._user = await User.findOne({
      where: { id: this.userId },
      attributes: ["organisationId"]
    }));
  }
}

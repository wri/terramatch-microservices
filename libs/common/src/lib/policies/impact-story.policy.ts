import { UserPermissionsPolicy } from "./user-permissions.policy";
import { ImpactStory, User } from "@terramatch-microservices/database/entities";

export class ImpactStoryPolicy extends UserPermissionsPolicy {
  async addRules() {
    if (this.frameworks.length > 0) {
      this.builder.can(["read", "create", "update", "delete", "bulkDelete", "uploadFiles"], ImpactStory);
    }

    if (this.permissions.includes("impact-stories-manage")) {
      this.builder.can(["create", "update", "delete", "uploadFiles"], ImpactStory);
    }

    if (this.permissions.includes("manage-own")) {
      const user = await this.getUser();
      if (user?.organisationId != null) {
        this.builder.can(["read", "update"], ImpactStory, {
          organizationId: user.organisationId
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

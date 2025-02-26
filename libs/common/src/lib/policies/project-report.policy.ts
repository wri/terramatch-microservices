import { UserPermissionsPolicy } from "./user-permissions.policy";
import { ProjectReport, User } from "@terramatch-microservices/database/entities";

export class ProjectReportPolicy extends UserPermissionsPolicy {
  async addRules() {
    if (this.permissions.includes("view-dashboard")) {
      this.builder.can("read", ProjectReport);
    }

    if (this.frameworks.length > 0) {
      this.builder.can("read", ProjectReport, { frameworkKey: { $in: this.frameworks } });
    }

    // if (this.permissions.includes("manage-own")) {
    // }
  }

  private _user?: User | null;
  private async getUser() {
    if (this._user != null) return this._user;

    return (this._user = await User.findOne({
      where: { id: this.userId },
      attributes: ["organisationId"],
      include: [{ association: "projects", attributes: ["id"] }]
    }));
  }
}

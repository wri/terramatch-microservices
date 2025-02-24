import { EntityPolicy } from "./entity.policy";
import { Site, User } from "@terramatch-microservices/database/entities";
import { FrameworkKey } from "@terramatch-microservices/database/constants/framework";

export class SitePolicy extends EntityPolicy {
  async addRules() {
    if (this.permissions.includes("sites-read") || this.permissions.includes("view-dashboard")) {
      this.builder.can("read", Site);
    }

    const frameworks = this.permissions
      .filter(name => name.startsWith("framework-"))
      .map(name => name.substring("framework-".length) as FrameworkKey);
    if (frameworks.length > 0) {
      this.builder.can("read", Site, { frameworkKey: { $in: frameworks } });
    }
  }

  protected _user?: User | null;
  protected async getUser() {
    if (this._user != null) return this._user;

    return (this._user = await User.findOne({
      where: { id: this.userId },
      attributes: ["organisationId"],
      include: [{ association: "sites", attributes: ["id"] }]
    }));
  }
}

import { UserPermissionsPolicy } from "./user-permissions.policy";

import { FinancialIndicator, User } from "@terramatch-microservices/database/entities";

export class FinancialIndicatorPolicy extends UserPermissionsPolicy {
  async addRules() {
    if (this.permissions.includes("projects-manage")) {
      const user = await this.getUser();
      if (user != null) {
        const projectIds = user.projects.filter(({ ProjectUser }) => ProjectUser.isManaging).map(({ id }) => id);
        if (projectIds.length > 0) {
          this.builder.can(["uploadFiles"], FinancialIndicator, {
            id: { $in: projectIds }
          });
        }
      }
    }
  }

  private _user?: User | null;
  private async getUser() {
    if (this._user != null) return this._user;

    return (this._user = await User.findOne({
      where: { id: this.userId },
      attributes: ["id"],
      include: [{ association: "projects", attributes: ["id"] }]
    }));
  }
}

import { EntityPolicy } from "./entity.policy";
import { Project, User } from "@terramatch-microservices/database/entities";
import { FrameworkKey } from "@terramatch-microservices/database/constants/framework";

export class ProjectPolicy extends EntityPolicy {
  async addRules() {
    if (this.permissions.includes("projects-read") || this.permissions.includes("view-dashboard")) {
      this.builder.can("read", Project);
    }

    const frameworks = this.permissions
      .filter(name => name.startsWith("framework-"))
      .map(name => name.substring("framework-".length) as FrameworkKey);
    if (frameworks.length > 0) {
      this.builder.can("read", Project, { frameworkKey: { $in: frameworks } });
    }

    if (this.permissions.includes("manage-own")) {
      const user = await this.getUser();
      if (user != null) {
        this.builder.can("read", Project, { organisationId: user.organisationId });
        const projectIds = user.projects.map(({ id }) => id);
        if (projectIds.length > 0) {
          this.builder.can("read", Project, { id: { $in: projectIds } });
        }
      }
    }

    if (this.permissions.includes("projects-manage")) {
      const user = await this.getUser();
      if (user != null) {
        const projectIds = user.projects.filter(({ ProjectUser }) => ProjectUser.isManaging).map(({ id }) => id);
        if (projectIds.length > 0) {
          this.builder.can("read", Project, { id: { $in: projectIds } });
        }
      }
    }
  }

  protected _user?: User;
  protected async getUser() {
    if (this._user != null) return this._user;

    return (this._user = await User.findOne({
      where: { id: this.userId },
      attributes: ["organisationId"],
      include: [{ association: "projects", attributes: ["id"] }]
    }));
  }
}

import { Project, User } from "@terramatch-microservices/database/entities";
import { UserPermissionsPolicy } from "./user-permissions.policy";
import { STARTED } from "@terramatch-microservices/database/constants/status";

export class ProjectPolicy extends UserPermissionsPolicy {
  async addRules() {
    if (this.permissions.includes("projects-read") || this.permissions.includes("view-dashboard")) {
      this.builder.can("read", Project);
    }

    if (this.frameworks.length > 0) {
      this.builder.can(["read", "delete", "update", "approve", "uploadFiles"], Project, {
        frameworkKey: { $in: this.frameworks }
      });
    }

    if (this.permissions.includes("manage-own")) {
      const user = await this.getUser();
      if (user != null) {
        this.builder.can(["read", "update"], Project, { organisationId: user.organisationId });
        this.builder.can("delete", Project, { organisationId: user.organisationId, status: STARTED });
        const projectIds = user.projects.map(({ id }) => id);
        if (projectIds.length > 0) {
          this.builder.can(["read", "update"], Project, { id: { $in: projectIds } });
          this.builder.can("delete", Project, { id: { $in: projectIds }, status: STARTED });
        }
      }
    }

    if (this.permissions.includes("projects-manage")) {
      const user = await this.getUser();
      if (user != null) {
        const projectIds = user.projects.filter(({ ProjectUser }) => ProjectUser.isManaging).map(({ id }) => id);
        if (projectIds.length > 0) {
          this.builder.can(["read", "delete", "update", "approve", "uploadFiles"], Project, {
            id: { $in: projectIds }
          });
        }
      }
    }
  }

  protected _user?: User | null;
  protected async getUser() {
    if (this._user != null) return this._user;

    return (this._user = await User.findOne({
      where: { id: this.userId },
      attributes: ["organisationId"],
      include: [{ association: "projects", attributes: ["id"] }]
    }));
  }
}

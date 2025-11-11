import { Project, Site, User } from "@terramatch-microservices/database/entities";
import { UserPermissionsPolicy } from "./user-permissions.policy";

export class SitePolicy extends UserPermissionsPolicy {
  async addRules() {
    if (this.permissions.includes("view-dashboard") || this.permissions.includes("projects-read")) {
      this.builder.can("read", Site);
      return;
    }

    if (this.frameworks.length > 0) {
      this.builder.can(["read", "delete", "update", "approve", "uploadFiles", "deleteFiles"], Site, {
        frameworkKey: { $in: this.frameworks }
      });
    }
    if (this.permissions.includes("media-manage")) {
      this.builder.can("uploadFiles", Site);
    }

    if (this.permissions.includes("manage-own")) {
      const user = await this.getUser();
      if (user != null) {
        const projectIds = [
          ...(user.organisationId === null
            ? []
            : await Project.findAll({ where: { organisationId: user.organisationId }, attributes: ["id"] })
          ).map(({ id }) => id),
          ...user.projects.map(({ id }) => id)
        ];

        if (projectIds.length > 0) {
          this.builder.can(["read", "delete", "update", "uploadFiles", "deleteFiles"], Site, {
            projectId: { $in: projectIds }
          });
        }
      }
    }

    if (this.permissions.includes("projects-manage")) {
      const user = await this.getUser();
      if (user != null) {
        const projectIds = user.projects.filter(({ ProjectUser }) => ProjectUser.isManaging).map(({ id }) => id);
        if (projectIds.length > 0) {
          this.builder.can(["read", "delete", "update", "approve", "uploadFiles", "deleteFiles"], Site, {
            projectId: { $in: projectIds }
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

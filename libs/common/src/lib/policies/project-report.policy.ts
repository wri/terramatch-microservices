import { UserPermissionsPolicy } from "./user-permissions.policy";
import { Project, ProjectReport, User } from "@terramatch-microservices/database/entities";

export class ProjectReportPolicy extends UserPermissionsPolicy {
  async addRules() {
    if (this.permissions.includes("view-dashboard")) {
      this.builder.can("read", ProjectReport);
      return;
    }

    if (this.frameworks.length > 0) {
      this.builder.can(["read", "delete", "update", "approve", "uploadFiles"], ProjectReport, {
        frameworkKey: { $in: this.frameworks }
      });
    }

    if (this.permissions.includes("manage-own")) {
      const user = await this.getUser();
      if (user != null) {
        const projectIds = [
          ...(user.organisationId == null
            ? []
            : await Project.findAll({ where: { organisationId: user.organisationId }, attributes: ["id"] })
          ).map(({ id }) => id),
          ...user.projects.map(({ id }) => id)
        ];
        if (projectIds.length > 0) {
          this.builder.can(["read", "update", "uploadFiles"], ProjectReport, { projectId: { $in: projectIds } });
        }
      }
    }

    if (this.permissions.includes("projects-manage")) {
      const user = await this.getUser();
      if (user != null) {
        const projectIds = user.projects.filter(({ ProjectUser }) => ProjectUser.isManaging).map(({ id }) => id);
        if (projectIds.length > 0) {
          this.builder.can(["read", "delete", "update", "approve", "uploadFiles"], ProjectReport, {
            projectId: { $in: projectIds }
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
      attributes: ["organisationId"],
      include: [{ association: "projects", attributes: ["id"] }]
    }));
  }
}

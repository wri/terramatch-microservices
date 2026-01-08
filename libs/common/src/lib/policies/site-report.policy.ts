import { UserPermissionsPolicy } from "./user-permissions.policy";
import { Project, Site, SiteReport, User } from "@terramatch-microservices/database/entities";
import { Op, WhereAttributeHash } from "sequelize";

export class SiteReportPolicy extends UserPermissionsPolicy {
  async addRules() {
    if (this.permissions.includes("view-dashboard") || this.permissions.includes("projects-read")) {
      this.builder.can("read", SiteReport);
      return;
    }

    if (this.frameworks.length > 0) {
      this.builder.can(
        ["read", "delete", "update", "approve", "uploadFiles", "deleteFiles", "updateFiles"],
        SiteReport,
        {
          frameworkKey: { $in: this.frameworks }
        }
      );
    }

    if (this.permissions.includes("manage-own")) {
      const user = await this.getUser();
      if (user != null) {
        const projectIds: WhereAttributeHash[] = [{ [Op.in]: user.projects.map(({ id }) => id) }];
        if (user.organisationId != null) {
          projectIds.push({ [Op.in]: Project.forOrganisation(user.organisationId) });
        }
        const siteIds = (
          await Site.findAll({
            where: { projectId: { [Op.or]: projectIds } },
            attributes: ["id"]
          })
        ).map(({ id }) => id);
        if (siteIds.length > 0) {
          this.builder.can(["read", "update", "uploadFiles", "deleteFiles", "updateFiles"], SiteReport, {
            siteId: { $in: siteIds }
          });
        }
      }
    }

    if (this.permissions.includes("projects-manage")) {
      const user = await this.getUser();
      if (user != null) {
        const projectIds = user.projects.filter(({ ProjectUser }) => ProjectUser.isManaging).map(({ id }) => id);
        if (projectIds.length > 0) {
          const siteIds = (
            await Site.findAll({ where: { projectId: { [Op.in]: projectIds } }, attributes: ["id"] })
          ).map(({ id }) => id);
          if (siteIds.length > 0) {
            this.builder.can(
              ["read", "delete", "update", "approve", "uploadFiles", "deleteFiles", "updateFiles"],
              SiteReport,
              {
                siteId: { $in: siteIds }
              }
            );
          }
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

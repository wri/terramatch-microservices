import { SitePolygon, Site, ProjectUser, User } from "@terramatch-microservices/database/entities";
import { UserPermissionsPolicy } from "./user-permissions.policy";
import { Op } from "sequelize";

export class SitePolygonPolicy extends UserPermissionsPolicy {
  async addRules() {
    const user = await this.getUser();

    if (this.permissions.includes("polygons-manage")) {
      this.builder.can(["read", "create"], SitePolygon);
      this.builder.can(["update", "delete"], SitePolygon, { createdBy: this.userId });
      return;
    }

    if (this.frameworks.length > 0) {
      const sites = await Site.findAll({
        where: { frameworkKey: { [Op.in]: this.frameworks } },
        attributes: ["uuid"]
      });
      const siteUuids = sites.map(site => site.uuid);
      this.builder.can(["manage", "delete"], SitePolygon, { siteUuid: { $in: siteUuids } });
    }

    if (this.permissions.includes("manage-own")) {
      const sites = await Site.findAll({
        where: { projectId: { [Op.in]: ProjectUser.userProjectsSubquery(this.userId) } },
        attributes: ["uuid"]
      });
      const siteUuids = sites.map(site => site.uuid);
      if (siteUuids.length > 0) {
        this.builder.can(["manage", "delete"], SitePolygon, { siteUuid: { $in: siteUuids } });
      }
    }

    if (this.permissions.includes("projects-manage")) {
      if (user != null) {
        const projectIds = user.projects.filter(({ ProjectUser }) => ProjectUser.isManaging).map(({ id }) => id);
        if (projectIds.length > 0) {
          const sites = await Site.findAll({
            where: { projectId: { [Op.in]: projectIds } },
            attributes: ["uuid"]
          });
          const siteUuids = sites.map(site => site.uuid);
          if (siteUuids.length > 0) {
            this.builder.can(["manage", "delete"], SitePolygon, { siteUuid: { $in: siteUuids } });
          }
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

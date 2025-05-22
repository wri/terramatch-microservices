import { SitePolygon, Site, User, Project } from "@terramatch-microservices/database/entities";
import { UserPermissionsPolicy } from "./user-permissions.policy";
import { Op } from "sequelize";

export class SitePolygonPolicy extends UserPermissionsPolicy {
  async addRules() {
    if (this.permissions.includes("polygons-manage")) {
      this.builder.can("manage", SitePolygon);
      return;
    }

    if (this.frameworks.length > 0) {
      const sites = await Site.findAll({
        where: { frameworkKey: { [Op.in]: this.frameworks } },
        attributes: ["uuid"]
      });
      const siteUuids = sites.map(site => site.uuid);
      this.builder.can("manage", SitePolygon, { siteUuid: { $in: siteUuids } });
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
          const sites = await Site.findAll({
            where: { projectId: { [Op.in]: projectIds } },
            attributes: ["uuid"]
          });

          const siteUuids = sites.map(site => site.uuid);
          if (siteUuids.length > 0) {
            this.builder.can("manage", SitePolygon, { siteUuid: { $in: siteUuids } });
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

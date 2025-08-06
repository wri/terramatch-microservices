import { SitePolygon, Site, ProjectUser } from "@terramatch-microservices/database/entities";
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
      const sites = await Site.findAll({
        where: { projectId: { [Op.in]: ProjectUser.userProjectsSubquery(this.userId) } },
        attributes: ["uuid"]
      });
      const siteUuids = sites.map(site => site.uuid);
      if (siteUuids.length > 0) {
        this.builder.can("manage", SitePolygon, { siteUuid: { $in: siteUuids } });
      }
    }
  }
}

import { SitePolygon, Site } from "@terramatch-microservices/database/entities";
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
        where: {
          frameworkKey: {
            [Op.in]: this.frameworks
          }
        }
      });
      const siteUuids = sites.map(site => site.uuid);
      this.builder.can("manage", SitePolygon, { siteUuid: { $in: siteUuids } });
    }
  }
}

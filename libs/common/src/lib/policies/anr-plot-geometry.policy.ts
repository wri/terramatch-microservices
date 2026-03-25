import { AnrPlotGeometry, ProjectUser, Site, SitePolygon, User } from "@terramatch-microservices/database/entities";
import { UserPermissionsPolicy } from "./user-permissions.policy";
import { Op } from "sequelize";

export class AnrPlotGeometryPolicy extends UserPermissionsPolicy {
  async addRules() {
    const user = await this.getUser();

    if (this.permissions.includes("polygons-manage")) {
      this.builder.can(["read", "create", "update", "delete"], AnrPlotGeometry);
    }

    if (this.permissions.includes("view-dashboard") || this.permissions.includes("projects-read")) {
      this.builder.can("read", AnrPlotGeometry);
    }

    if (this.frameworks.length > 0) {
      const sites = await Site.findAll({
        where: { frameworkKey: { [Op.in]: this.frameworks } },
        attributes: ["uuid"]
      });
      const siteUuids = sites.map(site => site.uuid);

      if (siteUuids.length > 0) {
        const sitePolygons = await SitePolygon.findAll({
          where: { siteUuid: { [Op.in]: siteUuids } },
          attributes: ["id"]
        });
        const sitePolygonIds = sitePolygons.map(sitePolygon => sitePolygon.id);
        if (sitePolygonIds.length > 0) {
          this.builder.can(["read", "manage", "delete"], AnrPlotGeometry, {
            sitePolygonId: { $in: sitePolygonIds }
          });
        }
      }
    }

    if (this.permissions.includes("manage-own")) {
      const sites = await Site.findAll({
        where: { projectId: { [Op.in]: ProjectUser.userProjectsSubquery(this.userId) } },
        attributes: ["uuid"]
      });
      const siteUuids = sites.map(site => site.uuid);
      if (siteUuids.length > 0) {
        const sitePolygons = await SitePolygon.findAll({
          where: { siteUuid: { [Op.in]: siteUuids } },
          attributes: ["id"]
        });
        const sitePolygonIds = sitePolygons.map(sitePolygon => sitePolygon.id);
        if (sitePolygonIds.length > 0) {
          this.builder.can(["read", "manage", "delete"], AnrPlotGeometry, {
            sitePolygonId: { $in: sitePolygonIds }
          });
        }
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
            const sitePolygons = await SitePolygon.findAll({
              where: { siteUuid: { [Op.in]: siteUuids } },
              attributes: ["id"]
            });
            const sitePolygonIds = sitePolygons.map(sitePolygon => sitePolygon.id);
            if (sitePolygonIds.length > 0) {
              this.builder.can(["read", "manage", "delete"], AnrPlotGeometry, {
                sitePolygonId: { $in: sitePolygonIds }
              });
            }
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

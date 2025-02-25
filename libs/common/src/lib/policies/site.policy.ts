import { EntityPolicy } from "./entity.policy";
import { Project, Site, User } from "@terramatch-microservices/database/entities";
import { FrameworkKey } from "@terramatch-microservices/database/constants/framework";
import { Op } from "sequelize";

export class SitePolicy extends EntityPolicy {
  async addRules() {
    if (this.permissions.includes("sites-read") || this.permissions.includes("view-dashboard")) {
      this.builder.can("read", Site);
    }

    const frameworks = this.permissions
      .filter(name => name.startsWith("framework-"))
      .map(name => name.substring("framework-".length) as FrameworkKey);
    if (frameworks.length > 0) {
      this.builder.can("read", Site, { frameworkKey: { $in: frameworks } });
    }

    if (this.permissions.includes("manage-own")) {
      const user = await this.getUser();
      if (user != null) {
        this.builder.can("read", Site);
        const sitesIds = user.projects.reduce((acc: number[], project) => {
          if (Array.isArray(project.sites)) {
            acc.push(
              ...project.sites.filter(site => site.project?.organisationId == user.organisationId).map(site => site.id)
            );
          }
          return acc;
        }, []);
        if (sitesIds.length > 0) {
          this.builder.can("read", Site, { id: { $in: sitesIds } });
        }
      }
    }

    if (this.permissions.includes("projects-manage")) {
      const user = await this.getUser();
      if (user != null) {
        const projectsId = user.projects.filter(project => project.ProjectUser.isManaging).map(project => project.id);
        const projects = Project.findAll({
          where: {
            id: { [Op.in]: projectsId }
          },
          include: {
            association: "sites"
          }
        });
        const sites = (await projects).map(project => project.sites?.map(site => site.id) ?? []).flat();
        if (sites.length > 0) {
          this.builder.can("read", Site, { id: { $in: sites } });
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

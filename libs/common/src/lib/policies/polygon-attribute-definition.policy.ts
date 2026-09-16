import { PolygonAttributeDefinition, ProjectUser, Site } from "@terramatch-microservices/database/entities";
import { FrameworkKey } from "@terramatch-microservices/database/constants";
import { Op } from "sequelize";
import { UserPermissionsPolicy } from "./user-permissions.policy";

export class PolygonAttributeDefinitionPolicy extends UserPermissionsPolicy {
  async addRules() {
    if (this.frameworks.length > 0) {
      this.builder.can(["read", "create", "update", "delete"], PolygonAttributeDefinition, {
        frameworkKey: { $in: this.frameworks }
      });
    }

    // Champions (manage-own) and project managers (projects-manage) may only read active
    const frameworkKeys = await this.readableSiteFrameworkKeys();
    if (frameworkKeys.size > 0) {
      this.builder.can("read", PolygonAttributeDefinition, { frameworkKey: { $in: [...frameworkKeys] } });
    }
  }

  private async readableSiteFrameworkKeys(): Promise<Set<FrameworkKey>> {
    const frameworkKeys = new Set<FrameworkKey>();

    if (this.permissions.includes("manage-own")) {
      const sites = await Site.findAll({
        where: { projectId: { [Op.in]: ProjectUser.userProjectsSubquery(this.userId) } },
        attributes: ["frameworkKey"]
      });
      sites.forEach(({ frameworkKey }) => {
        if (frameworkKey != null) frameworkKeys.add(frameworkKey);
      });
    }

    if (this.permissions.includes("projects-manage")) {
      const sites = await Site.findAll({
        where: { projectId: { [Op.in]: ProjectUser.projectsManageSubquery(this.userId) } },
        attributes: ["frameworkKey"]
      });
      sites.forEach(({ frameworkKey }) => {
        if (frameworkKey != null) frameworkKeys.add(frameworkKey);
      });
    }

    return frameworkKeys;
  }
}

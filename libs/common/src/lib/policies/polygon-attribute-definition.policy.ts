import { PolygonAttributeDefinition } from "@terramatch-microservices/database/entities";
import { UserPermissionsPolicy } from "./user-permissions.policy";

export class PolygonAttributeDefinitionPolicy extends UserPermissionsPolicy {
  async addRules() {
    if (this.frameworks.length === 0) return;

    this.builder.can(["read", "create", "update", "delete"], PolygonAttributeDefinition, {
      frameworkKey: { $in: this.frameworks }
    });
  }
}

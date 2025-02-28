import { SitePolygon } from "@terramatch-microservices/database/entities";
import { UserPermissionsPolicy } from "./user-permissions.policy";

export class SitePolygonPolicy extends UserPermissionsPolicy {
  async addRules() {
    if (this.permissions.includes("polygons-manage")) {
      this.builder.can("manage", SitePolygon);
    }
  }
}

import { EntityPolicy } from "./entity.policy";
import { SitePolygon } from "@terramatch-microservices/database/entities";

export class SitePolygonPolicy extends EntityPolicy {
  async addRules() {
    if (this.permissions.includes("polygons-manage")) {
      this.builder.can("manage", SitePolygon);
    }
  }
}

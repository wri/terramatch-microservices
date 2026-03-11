import { AnrPlotGeometry } from "@terramatch-microservices/database/entities";
import { UserPermissionsPolicy } from "./user-permissions.policy";

export class AnrPlotGeometryPolicy extends UserPermissionsPolicy {
  async addRules() {
    if (this.permissions.includes("polygons-manage")) {
      this.builder.can(["read", "create", "update", "delete"], AnrPlotGeometry);
    }

    if (
      this.permissions.includes("view-dashboard") ||
      this.permissions.includes("projects-read") ||
      this.permissions.includes("manage-own") ||
      this.permissions.includes("projects-manage")
    ) {
      this.builder.can("read", AnrPlotGeometry);
    }
  }
}

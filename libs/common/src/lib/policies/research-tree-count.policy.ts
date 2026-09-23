import { ResearchTreeCount } from "@terramatch-microservices/database/entities";
import { UserPermissionsPolicy } from "./user-permissions.policy";

export class ResearchTreeCountPolicy extends UserPermissionsPolicy {
  async addRules() {
    if (this.permissions.includes("polygons-manage")) {
      this.builder.can("read", ResearchTreeCount);
    }
  }
}

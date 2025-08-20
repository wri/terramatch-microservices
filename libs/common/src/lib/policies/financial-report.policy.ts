import { UserPermissionsPolicy } from "./user-permissions.policy";
import { FinancialReport } from "@terramatch-microservices/database/entities";

export class FinancialReportPolicy extends UserPermissionsPolicy {
  async addRules() {
    this.builder.can(["read", "delete"], FinancialReport);
  }
}

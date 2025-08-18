import { UserPermissionsPolicy } from "./user-permissions.policy";
import { FinancialReport } from "@terramatch-microservices/database/entities";

export class FinancialReportPolicy extends UserPermissionsPolicy {
  async addRules() {
    // Allow all actions for FinancialReport - temporary open access
    this.builder.can(["read", "delete", "update", "approve", "uploadFiles"], FinancialReport);
  }
}

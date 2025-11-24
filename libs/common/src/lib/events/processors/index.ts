import { EntityApprovalProcessor } from "./types";
import { FieldsApprovalProcessor } from "./fields.approval-processor";
import { FundingTypeApprovalProcessor } from "./funding-type.approval-processor";
import { FinancialIndicatorApprovalProcessor } from "./financial-indicator.approval-processor";
import { DisturbanceReportEntryApprovalProcessor } from "./disturbance-report-entry.approval-processor";
import { DemographicApprovalProcessor } from "./demographic.approval-processor";

// A set of processors that should be run any time an EntityType model moves to approved status.
export const APPROVAL_PROCESSERS: EntityApprovalProcessor[] = [
  FieldsApprovalProcessor,
  FundingTypeApprovalProcessor,
  FinancialIndicatorApprovalProcessor,
  DisturbanceReportEntryApprovalProcessor,
  DemographicApprovalProcessor
];

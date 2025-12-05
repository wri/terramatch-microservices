import { FactoryGirl } from "factory-girl-ts";
import { DisturbanceReport, DisturbanceReportEntry } from "../entities";
import { DisturbanceReportFactory } from "./disturbance-report.factory";

export const DisturbanceReportEntryFactory = {
  report: (report?: DisturbanceReport) =>
    FactoryGirl.define(DisturbanceReportEntry, async () => ({
      disturbanceReportId: (report?.id as number) ?? DisturbanceReportFactory.associate("id"),
      name: "test-entry",
      inputType: "text",
      title: "Test Entry",
      subtitle: null,
      value: "test-value"
    }))
};

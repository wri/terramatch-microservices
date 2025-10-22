import { FactoryGirl } from "factory-girl-ts";
import { DisturbanceReportEntry } from "../entities/disturbance-report-entry.entity";

export const DisturbanceReportEntryFactory = FactoryGirl.define(DisturbanceReportEntry, async () => ({
  name: "test-entry",
  inputType: "text",
  title: "Test Entry",
  subtitle: null,
  value: "test-value"
}));

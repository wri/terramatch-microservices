import { RelationResourceCollector } from "./index";
import { DisturbanceReportEntryFactory, DisturbanceReportFactory } from "@terramatch-microservices/database/factories";
import { EmbeddedDisturbanceReportEntryDto } from "../../dto/disturbance-report-entry.dto";
import { DisturbanceReportEntry, SiteReport } from "@terramatch-microservices/database/entities";
import { LinkedRelation } from "@terramatch-microservices/database/constants/linked-fields";
import { CollectorTestHarness, getRelation } from "../../util/testing";

describe("DisturbanceReportEntriesCollector", () => {
  let harness: CollectorTestHarness;
  let collector: RelationResourceCollector;
  let field: LinkedRelation;

  beforeEach(() => {
    harness = new CollectorTestHarness();
    collector = harness.collector.disturbanceReportEntries;
    field = getRelation("dis-rep-entries");
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("collect", () => {
    it("throws if the modelType is not disturbance reports", async () => {
      expect(() => collector.addField(field, "sites", "one")).toThrow(
        "disturbanceReportEntries is only supported on disturbanceReports"
      );
    });

    it("ignores a missing report", async () => {
      collector.addField(field, "disturbanceReports", "one");
      await harness.expectAnswers({}, {});
    });

    it("sets the entries answer", async () => {
      collector.addField(field, "disturbanceReports", "one");
      collector.addField(field, "disturbanceReports", "two");

      const report = await DisturbanceReportFactory.create();
      const intensity = await DisturbanceReportEntryFactory.report(report).create({
        name: "intensity",
        value: "high",
        inputType: "select"
      });
      const date = await DisturbanceReportEntryFactory.report(report).create({
        name: "date-of-disturbance",
        value: "2023-12-01",
        inputType: "date"
      });

      await harness.expectAnswers(
        { disturbanceReports: report },
        { two: [new EmbeddedDisturbanceReportEntryDto(intensity), new EmbeddedDisturbanceReportEntryDto(date)] }
      );
    });
  });

  describe("sync", () => {
    it("throws if a bad model is provided", async () => {
      await expect(collector.syncRelation(new SiteReport(), field, null, false)).rejects.toThrow(
        "disturbanceReportEntries is only supported on disturbanceReports"
      );
    });

    it("updates and creates entries", async () => {
      const report = await DisturbanceReportFactory.create();
      const intensity = await DisturbanceReportEntryFactory.report(report).create({
        name: "intensity",
        value: "high",
        inputType: "select"
      });
      const date = await DisturbanceReportEntryFactory.report(report).create({
        name: "date-of-disturbance",
        value: "2023-12-01",
        inputType: "date"
      });

      await collector.syncRelation(
        report,
        field,
        [
          { name: "extent", value: "large", inputType: "text" },
          { name: "date-of-disturbance", value: "2023-12-02" }
        ],
        false
      );

      await intensity.reload({ paranoid: false });
      await date.reload();
      const allEntries = await DisturbanceReportEntry.report(report.id).findAll();
      expect(intensity.deletedAt).not.toBeNull();
      expect(date.value).toBe("2023-12-02");
      expect(allEntries.length).toBe(2);
      expect(allEntries.find(({ name }) => name === "extent")).toMatchObject({
        name: "extent",
        value: "large",
        inputType: "text"
      });
    });
  });
});

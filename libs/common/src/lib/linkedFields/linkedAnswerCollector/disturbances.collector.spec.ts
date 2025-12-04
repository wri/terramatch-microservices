import { CollectorTestHarness, getRelation } from "./linked-answer-collector.spec";
import { RelationResourceCollector } from "./index";
import { LinkedRelation } from "@terramatch-microservices/database/constants/linked-fields";
import { DisturbanceFactory, SiteFactory, SiteReportFactory } from "@terramatch-microservices/database/factories";
import { EmbeddedDisturbanceDto } from "../../dto/disturbance.dto";
import { Disturbance } from "@terramatch-microservices/database/entities";

describe("DisturbancesCollector", () => {
  let harness: CollectorTestHarness;
  let collector: RelationResourceCollector;
  let reportField: LinkedRelation;
  let siteField: LinkedRelation;

  beforeEach(() => {
    harness = new CollectorTestHarness();
    collector = harness.collector.disturbances;
    reportField = getRelation("site-rep-rel-disturbances");
    siteField = getRelation("site-rel-disturbances");
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("collect", () => {
    it("throws if a model is missing", async () => {
      collector.addField(siteField, "sites", "one");
      await expect(harness.getAnswers({})).rejects.toThrow("Model for type not found: sites");
    });

    it("sets the answers", async () => {
      collector.addField(siteField, "sites", "one");
      collector.addField(reportField, "siteReports", "two");

      const site = await SiteFactory.create();
      const report = await SiteReportFactory.create();
      const siteDisturbances = await DisturbanceFactory.site(site).createMany(2);
      const reportDisturbance = await DisturbanceFactory.siteReport(report).create();

      await Promise.all([...siteDisturbances, reportDisturbance].map(disturbance => disturbance.reload()));
      await harness.expectAnswers(
        { sites: site, siteReports: report },
        {
          one: siteDisturbances.map(disturbance => new EmbeddedDisturbanceDto(disturbance)),
          two: [new EmbeddedDisturbanceDto(reportDisturbance)]
        }
      );
    });
  });

  describe("sync", () => {
    it("updates and creates disturbances", async () => {
      const site = await SiteFactory.create();
      const disturbances = await DisturbanceFactory.site(site).createMany(2);

      await collector.syncRelation(
        site,
        siteField,
        [
          { uuid: disturbances[0].uuid, type: "manmade", intensity: "high", extent: "large", description: "updated" },
          { type: "climatic", intensity: "low", description: "new" }
        ],
        false
      );

      await Promise.all(disturbances.map(disturbance => disturbance.reload({ paranoid: false })));
      const allDisturbances = await Disturbance.for(site).findAll();
      expect(disturbances[1].deletedAt).not.toBeNull();
      expect(disturbances[0]).toMatchObject({
        type: "manmade",
        intensity: "high",
        extent: "large",
        description: "updated"
      });
      expect(allDisturbances.length).toBe(2);
      expect(allDisturbances.find(({ type }) => type === "climatic")).toMatchObject({
        type: "climatic",
        intensity: "low",
        description: "new"
      });
    });
  });
});

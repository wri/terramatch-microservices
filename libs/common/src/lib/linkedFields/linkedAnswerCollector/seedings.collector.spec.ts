import { RelationResourceCollector } from "./index";
import { LinkedRelation } from "@terramatch-microservices/database/constants/linked-fields";
import { SeedingFactory, SiteFactory, SiteReportFactory } from "@terramatch-microservices/database/factories";
import { EmbeddedSeedingDto } from "../../dto/seeding.dto";
import { Seeding } from "@terramatch-microservices/database/entities";
import { orderBy } from "lodash";
import { CollectorTestHarness, getRelation } from "../../util/testing";

describe("SeedingsCollector", () => {
  let harness: CollectorTestHarness;
  let collector: RelationResourceCollector;
  let reportField: LinkedRelation;
  let siteField: LinkedRelation;

  beforeEach(() => {
    harness = new CollectorTestHarness();
    collector = harness.collector.seedings;
    reportField = getRelation("site-rep-rel-seedings");
    siteField = getRelation("site-rel-seedings");
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
      const siteSeedings = await SeedingFactory.site(site).createMany(2);
      const reportSeeding = await SeedingFactory.siteReport(report).create();

      await Promise.all([...siteSeedings, reportSeeding].map(seeding => seeding.reload()));
      await harness.expectAnswers(
        { sites: site, siteReports: report },
        {
          one: orderBy(siteSeedings, "id").map(seeding => new EmbeddedSeedingDto(seeding)),
          two: [new EmbeddedSeedingDto(reportSeeding)]
        }
      );
    });
  });

  describe("sync", () => {
    it("updates and creates seedings", async () => {
      const site = await SiteFactory.create();
      const seedings = await SeedingFactory.site(site).createMany(2);

      await collector.syncRelation(
        site,
        siteField,
        [
          { uuid: seedings[0].uuid, name: "Bamboo", amount: 200, seedsInSample: null, weightOfSample: null },
          { name: "Acacia", amount: 50, seedsInSample: 10, weightOfSample: 0.5 }
        ],
        false
      );

      await Promise.all(seedings.map(seeding => seeding.reload({ paranoid: false })));

      const allSeedings = await Seeding.for(site).findAll();
      expect(seedings[1].deletedAt).not.toBeNull();
      expect(seedings[0]).toMatchObject({
        name: "Bamboo",
        amount: 200,
        seedsInSample: null,
        weightOfSample: null
      });
      expect(allSeedings.length).toBe(2);
      expect(allSeedings.find(({ name }) => name === "Acacia")).toMatchObject({
        amount: 50,
        seedsInSample: 10,
        weightOfSample: 0.5
      });
    });
  });
});

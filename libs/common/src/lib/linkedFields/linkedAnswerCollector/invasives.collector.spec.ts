import { RelationResourceCollector } from "./index";
import { LinkedRelation } from "@terramatch-microservices/database/constants/linked-fields";
import { InvasiveFactory, SiteFactory } from "@terramatch-microservices/database/factories";
import { Invasive } from "@terramatch-microservices/database/entities";
import { EmbeddedInvasiveDto } from "../../dto/invasive.dto";
import { orderBy } from "lodash";
import { CollectorTestHarness, getRelation } from "../../util/testing";

describe("InvasivesCollector", () => {
  let harness: CollectorTestHarness;
  let collector: RelationResourceCollector;
  let siteField: LinkedRelation;

  beforeEach(() => {
    harness = new CollectorTestHarness();
    collector = harness.collector.invasives;
    siteField = getRelation("site-rel-invasive");
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

      const site = await SiteFactory.create();
      const siteInvasives = await InvasiveFactory.site(site).createMany(2);

      await Promise.all(siteInvasives.map(invaisve => invaisve.reload()));
      await harness.expectAnswers(
        { sites: site },
        {
          one: orderBy(siteInvasives, "id").map(invasive => new EmbeddedInvasiveDto(invasive))
        }
      );
    });
  });

  describe("sync", () => {
    it("updates and creates invasives", async () => {
      const site = await SiteFactory.create();
      const invasives = await InvasiveFactory.site(site).createMany(2);

      await collector.syncRelation(
        site,
        siteField,
        [
          { uuid: invasives[0].uuid, type: "foo", name: "Bar" },
          { type: "common", name: "Bamboo" }
        ],
        false
      );

      await Promise.all(invasives.map(invasive => invasive.reload({ paranoid: false })));
      const allInvasives = await Invasive.for(site).findAll();
      expect(invasives[1].deletedAt).not.toBeNull();
      expect(invasives[0]).toMatchObject({ type: "foo", name: "Bar" });
      expect(allInvasives.length).toBe(2);
      expect(allInvasives.find(({ type }) => type === "common")).toMatchObject({ name: "Bamboo" });
    });
  });
});

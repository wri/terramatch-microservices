import { CollectorTestHarness, getRelation } from "./linked-answer-collector.spec";
import { RelationResourceCollector } from "./index";
import { LinkedRelation } from "@terramatch-microservices/database/constants/linked-fields";
import { SiteFactory, StratasFactory } from "@terramatch-microservices/database/factories";
import { Strata } from "@terramatch-microservices/database/entities";
import { EmbeddedStrataDto } from "../../dto/strata.dto";
import { orderBy } from "lodash";

describe("StratasCollector", () => {
  let harness: CollectorTestHarness;
  let collector: RelationResourceCollector;
  let siteField: LinkedRelation;

  beforeEach(() => {
    harness = new CollectorTestHarness();
    collector = harness.collector.stratas;
    siteField = getRelation("site-rel-stratas");
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
      const siteStratas = await StratasFactory.site(site).createMany(2);

      await Promise.all(siteStratas.map(strata => strata.reload()));
      await harness.expectAnswers(
        { sites: site },
        {
          one: orderBy(siteStratas, "id").map(strata => new EmbeddedStrataDto(strata))
        }
      );
    });
  });

  describe("sync", () => {
    it("updates and creates stratas", async () => {
      const site = await SiteFactory.create();
      const stratas = await StratasFactory.site(site).createMany(2);

      await collector.syncRelation(
        site,
        siteField,
        [
          { uuid: stratas[0].uuid, description: "updated description", extent: 42 },
          { description: "new description", extent: 99 }
        ],
        false
      );

      await Promise.all(stratas.map(strata => strata.reload({ paranoid: false })));
      const allStratas = await Strata.for(site).findAll();
      expect(stratas[1].deletedAt).not.toBeNull();
      expect(stratas[0]).toMatchObject({ description: "updated description", extent: 42 });
      expect(allStratas.length).toBe(2);
      expect(allStratas.find(({ description }) => description === "new description")).toMatchObject({ extent: 99 });
    });
  });
});

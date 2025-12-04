import { CollectorTestHarness, getRelation } from "./linked-answer-collector.spec";
import { RelationResourceCollector } from "./index";
import { LinkedRelation } from "@terramatch-microservices/database/constants/linked-fields";
import { SiteFactory, SiteReportFactory, TreeSpeciesFactory } from "@terramatch-microservices/database/factories";
import { TreeSpecies } from "@terramatch-microservices/database/entities";
import { EmbeddedTreeSpeciesDto } from "../../dto/tree-species.dto";

describe("TreeSpeciesCollector", () => {
  let harness: CollectorTestHarness;
  let collector: RelationResourceCollector;
  let reportField: LinkedRelation;
  let siteField: LinkedRelation;

  beforeEach(() => {
    harness = new CollectorTestHarness();
    collector = harness.collector.treeSpecies;
    reportField = getRelation("site-rep-rel-tree-species");
    siteField = getRelation("site-rel-tree-species");
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
      const siteTrees = await TreeSpeciesFactory.siteTreePlanted(site).createMany(2);
      const reportTree = await TreeSpeciesFactory.siteReportTreePlanted(report).create();

      await Promise.all([...siteTrees, reportTree].map(tree => tree.reload()));
      await harness.expectAnswers(
        { sites: site, siteReports: report },
        {
          one: siteTrees.map(tree => new EmbeddedTreeSpeciesDto(tree)),
          two: [new EmbeddedTreeSpeciesDto(reportTree)]
        }
      );
    });
  });

  describe("sync", () => {
    it("updates and creates tree species", async () => {
      const site = await SiteFactory.create();
      const trees = await TreeSpeciesFactory.siteTreePlanted(site).createMany(2);

      await collector.syncRelation(
        site,
        siteField,
        [
          { uuid: trees[0].uuid, name: "Coffee", amount: 200 },
          { name: "Bamboo", amount: 50 }
        ],
        false
      );

      await Promise.all(trees.map(tree => tree.reload({ paranoid: false })));
      const allTrees = await TreeSpecies.for(site).findAll();
      expect(trees[1].deletedAt).not.toBeNull();
      expect(trees[0]).toMatchObject({ name: "Coffee", amount: 200, collection: "tree-planted" });
      expect(allTrees.length).toBe(2);
      expect(allTrees.find(({ name }) => name === "Bamboo")).toMatchObject({
        amount: 50,
        collection: "tree-planted"
      });
    });
  });
});

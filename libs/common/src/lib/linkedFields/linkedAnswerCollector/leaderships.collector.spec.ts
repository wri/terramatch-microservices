import { CollectorTestHarness, getRelation } from "./linked-answer-collector.spec";
import { RelationResourceCollector } from "./index";
import { LeadershipFactory, OrganisationFactory } from "@terramatch-microservices/database/factories";
import { EmbeddedLeadershipDto } from "../../dto/leadership.dto";
import { orderBy } from "lodash";
import { Leadership, Organisation, Project } from "@terramatch-microservices/database/entities";

describe("LeadershipsCollector", () => {
  let harness: CollectorTestHarness;
  let collector: RelationResourceCollector;

  beforeEach(() => {
    harness = new CollectorTestHarness();
    collector = harness.collector.leaderships;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("collect", () => {
    it("throws when the model is not orgs", async () => {
      expect(() => collector.addField(getRelation("org-leadership-team"), "siteReports", "one")).toThrow(
        "leaderships is only supported on org"
      );
    });

    it("throws when the field does not have a collection", async () => {
      expect(() =>
        collector.addField({ inputType: "leaderships", label: "", resource: "leaderships" }, "organisations", "one")
      ).toThrow("collection not found for leaderships");
    });

    it("throws when the org model is missing", async () => {
      collector.addField(getRelation("org-leadership-team"), "organisations", "one");
      await expect(harness.getAnswers({})).rejects.toThrow("missing org for leaderships");
    });

    it("supplies leadership answers", async () => {
      collector.addField(getRelation("org-leadership-team"), "organisations", "one");
      collector.addField(getRelation("org-core-team-leaders"), "organisations", "two");

      const org = await OrganisationFactory.create();
      const team = await LeadershipFactory.org(org).createMany(3, { collection: "leadership-team" });
      const core = await LeadershipFactory.org(org).createMany(5, { collection: "core-team-leaders" });

      await Promise.all([...team, ...core].map(leadership => leadership.reload()));

      await harness.expectAnswers(
        { organisations: org },
        {
          one: orderBy(team, "id").map(leadership => new EmbeddedLeadershipDto(leadership)),
          two: orderBy(core, "id").map(leadership => new EmbeddedLeadershipDto(leadership))
        }
      );
    });
  });

  describe("sync", () => {
    it("throws if the model is not an org", async () => {
      await expect(
        collector.syncRelation(new Project(), getRelation("org-leadership-team"), [], false)
      ).rejects.toThrow("Only orgs are supported for leaderships");
    });

    it("throws if the field is missing a collection", async () => {
      await expect(
        collector.syncRelation(
          new Organisation(),
          { inputType: "leaderships", label: "", resource: "leaderships" },
          [],
          false
        )
      ).rejects.toThrow("Field missing collection leaderships");
    });

    it("updates and creates leaderships", async () => {
      const org = await OrganisationFactory.create();
      const leaderships = await LeadershipFactory.org(org).createMany(2, { collection: "leadership-team" });

      await collector.syncRelation(
        org,
        getRelation("org-leadership-team"),
        [
          {
            uuid: leaderships[0].uuid,
            nationality: "Spain",
            firstName: "Javier",
            lastName: "Bardem",
            position: "Actor",
            gender: "male",
            age: 42
          },
          {
            nationality: "Germany",
            firstName: "Max",
            lastName: "Mustermann",
            position: "Director",
            gender: "female",
            age: 21
          }
        ],
        false
      );

      await Promise.all(leaderships.map(leadership => leadership.reload({ paranoid: false })));
      const allLeaderships = await Leadership.organisation(org.id).collection("leadership-team").findAll();

      expect(leaderships[1].deletedAt).not.toBeNull();
      expect(leaderships[0]).toMatchObject({
        nationality: "Spain",
        firstName: "Javier",
        lastName: "Bardem",
        position: "Actor",
        gender: "male",
        age: 42
      });
      expect(allLeaderships.length).toBe(2);
      expect(allLeaderships.find(({ nationality }) => nationality === "Germany")).toMatchObject({
        nationality: "Germany",
        firstName: "Max",
        lastName: "Mustermann",
        position: "Director",
        gender: "female",
        age: 21
      });
    });
  });
});

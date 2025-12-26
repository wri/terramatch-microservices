import { CollectorTestHarness, getRelation } from "../../util/testing";
import { RelationResourceCollector } from "./index";
import { LinkedRelation } from "@terramatch-microservices/database/constants/linked-fields";
import { OrganisationFactory, OwnershipStakeFactory } from "@terramatch-microservices/database/factories";
import { orderBy } from "lodash";
import { EmbeddedOwnershipStakeDto } from "../../dto/ownership-stake.dto";
import { OwnershipStake, Project } from "@terramatch-microservices/database/entities";

describe("OwnershipStakeCollector", () => {
  let harness: CollectorTestHarness;
  let collector: RelationResourceCollector;
  let field: LinkedRelation;

  beforeEach(() => {
    harness = new CollectorTestHarness();
    collector = harness.collector.ownershipStake;
    field = getRelation("org-ownership-stake");
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("collect", () => {
    it("throws when the model is not orgs", async () => {
      expect(() => collector.addField(field, "siteReports", "one")).toThrow("ownership stake is only supported on org");
    });

    it("throws when the org model is missing", async () => {
      collector.addField(field, "organisations", "one");
      await expect(harness.getAnswers({})).rejects.toThrow("missing org for ownership stake");
    });

    it("supplies ownership stake answers", async () => {
      collector.addField(field, "organisations", "one");
      collector.addField(field, "organisations", "two");

      const org = await OrganisationFactory.create();
      const stakes = await OwnershipStakeFactory.org(org).createMany(3);
      await Promise.all(stakes.map(stake => stake.reload()));

      await harness.expectAnswers(
        { organisations: org },
        {
          two: orderBy(stakes, "id").map(stake => new EmbeddedOwnershipStakeDto(stake))
        }
      );
    });
  });

  describe("sync", () => {
    it("throws if the model is not an org", async () => {
      await expect(collector.syncRelation(new Project(), field, [], false)).rejects.toThrow(
        "Only orgs are supported for ownershipStakes"
      );
    });

    it("updates and creates ownership stakes", async () => {
      const org = await OrganisationFactory.create();
      const stakes = await OwnershipStakeFactory.org(org).createMany(2);

      await collector.syncRelation(
        org,
        field,
        [
          {
            uuid: stakes[0].uuid,
            firstName: "Javier",
            lastName: "Bardem",
            title: "Actor",
            gender: "male",
            percentOwnership: 42,
            yearOfBirth: 1965
          },
          {
            firstName: "Max",
            lastName: "Mustermann",
            title: "Director",
            gender: "female",
            percentOwnership: 58,
            yearOfBirth: 1980
          }
        ],
        false
      );

      await Promise.all(stakes.map(stake => stake.reload({ paranoid: false })));
      const allStakes = await OwnershipStake.organisation(org.uuid).findAll();

      expect(stakes[1].deletedAt).not.toBeNull();
      expect(stakes[0]).toMatchObject({
        firstName: "Javier",
        lastName: "Bardem",
        title: "Actor",
        gender: "male",
        percentOwnership: 42,
        yearOfBirth: 1965
      });
      expect(allStakes.length).toBe(2);
      expect(allStakes.find(({ firstName }) => firstName === "Max")).toMatchObject({
        lastName: "Mustermann",
        title: "Director",
        gender: "female",
        percentOwnership: 58,
        yearOfBirth: 1980
      });
    });
  });
});

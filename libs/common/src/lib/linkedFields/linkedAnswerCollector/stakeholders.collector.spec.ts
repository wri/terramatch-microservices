import { RelationResourceCollector } from "./index";
import { LinkedRelation } from "@terramatch-microservices/database/constants/linked-fields";
import { ProjectPitchFactory, StakeholdersFactory } from "@terramatch-microservices/database/factories";
import { Stakeholder } from "@terramatch-microservices/database/entities";
import { EmbeddedStakeholderDto } from "../../dto/stakeholder.dto";
import { orderBy } from "lodash";
import { CollectorTestHarness, getRelation } from "../../util/testing";

describe("StakeholdersCollector", () => {
  let harness: CollectorTestHarness;
  let collector: RelationResourceCollector;
  let pitchField: LinkedRelation;

  beforeEach(() => {
    harness = new CollectorTestHarness();
    collector = harness.collector.stakeholders;
    pitchField = getRelation("pro-pit-stakeholders");
  });

  describe("collect", () => {
    it("throws if a model is missing", async () => {
      collector.addField(pitchField, "projectPitches", "one");
      await expect(harness.getAnswers({})).rejects.toThrow("Model for type not found: projectPitches");
    });

    it("sets the answers", async () => {
      collector.addField(pitchField, "projectPitches", "one");

      const pitch = await ProjectPitchFactory.create();
      const stakeholders = await StakeholdersFactory.projectPitch(pitch).createMany(2);
      // a stakeholder on another pitch should not be included
      await StakeholdersFactory.projectPitch().create();

      await Promise.all(stakeholders.map(stakeholder => stakeholder.reload()));
      await harness.expectAnswers(
        { projectPitches: pitch },
        { one: orderBy(stakeholders, "id").map(stakeholder => new EmbeddedStakeholderDto(stakeholder)) }
      );
    });

    it("serializes answers for export", async () => {
      collector.addField(pitchField, "projectPitches", "one");

      const pitch = await ProjectPitchFactory.create();
      const stakeholder = await StakeholdersFactory.projectPitch(pitch).create();

      await harness.expectAnswers(
        { projectPitches: pitch },
        { one: [`${stakeholder.name}:${stakeholder.keyRole}:${stakeholder.description}`] },
        { forExport: true }
      );
    });
  });

  describe("sync", () => {
    it("updates, creates and removes stakeholders", async () => {
      const pitch = await ProjectPitchFactory.create();
      const stakeholders = await StakeholdersFactory.projectPitch(pitch).createMany(2);

      await collector.syncRelation(
        pitch,
        pitchField,
        [
          { uuid: stakeholders[0].uuid, name: "Updated name", keyRole: "owners", description: "Updated description" },
          { name: "New stakeholder", keyRole: "stewards", description: "New description" }
        ],
        false
      );

      await Promise.all(stakeholders.map(stakeholder => stakeholder.reload({ paranoid: false })));
      const allStakeholders = await Stakeholder.for(pitch).findAll();
      expect(stakeholders[1].deletedAt).not.toBeNull();
      expect(stakeholders[0]).toMatchObject({
        name: "Updated name",
        keyRole: "owners",
        description: "Updated description"
      });
      expect(allStakeholders.length).toBe(2);
      expect(allStakeholders.find(({ name }) => name === "New stakeholder")).toMatchObject({
        keyRole: "stewards",
        description: "New description"
      });
    });
  });
});

import { CollectorTestHarness, getField } from "./linked-answer-collector.spec";
import {
  DemographicEntryFactory,
  DemographicFactory,
  FormQuestionFactory,
  NurseryFactory,
  POLYGON,
  ProjectPitchFactory,
  ProjectPolygonFactory,
  ProjectReportFactory,
  SiteFactory
} from "@terramatch-microservices/database/factories";
import { faker } from "@faker-js/faker";
import { VirtualDemographicsAggregate } from "@terramatch-microservices/database/constants/linked-fields";
import {
  Demographic,
  DemographicEntry,
  FormQuestion,
  ProjectPitch,
  ProjectReport
} from "@terramatch-microservices/database/entities";
import { FieldResourceCollector } from "./index";

describe("FieldCollector", () => {
  let harness: CollectorTestHarness;
  let collector: FieldResourceCollector;

  beforeEach(() => {
    harness = new CollectorTestHarness();
    collector = harness.collector.fields;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("collects property fields", async () => {
    collector.addField(getField("site-name"), "sites", "one");
    collector.addField(getField("nur-name"), "nurseries", "two");
    // Should NOOP in collect().
    collector.addField(getField("pro-name"), "projects", "three");
    collector.addField(getField("site-landscape-community-contribution"), "sites", "four");

    const site = await SiteFactory.create({ landscapeCommunityContribution: faker.lorem.paragraph(2) });
    const nursery = await NurseryFactory.create();
    await harness.expectAnswers(
      { sites: site, nurseries: nursery },
      { one: site.name, two: nursery.name, four: site.landscapeCommunityContribution }
    );
  });

  it("collections polygon fields", async () => {
    collector.addField(getField("pro-pit-proj-boundary"), "projectPitches", "one");

    const pitch = await ProjectPitchFactory.create();
    await ProjectPolygonFactory.forPitch(pitch).create();
    await harness.expectAnswers({ projectPitches: pitch }, { one: POLYGON });
  });

  it("collects demographicsDescription virtual fields", async () => {
    collector.addField(getField("pro-rep-other-workdays-description"), "projectReports", "one");

    const projectReport = await ProjectReportFactory.create();
    // Unrelated demos (one wrong type, one wrong collection)
    await DemographicFactory.projectReport(projectReport).create({
      type: "workdays",
      collection: "volunteer-project-management",
      description: faker.lorem.paragraph()
    });
    await DemographicFactory.projectReport(projectReport).create({
      type: "jobs",
      collection: "paid-other-activities",
      description: faker.lorem.paragraph()
    });
    const demo = await DemographicFactory.projectReport(projectReport).create({
      type: "workdays",
      collection: "paid-other-activities",
      description: faker.lorem.paragraph()
    });

    await harness.expectAnswers({ projectReports: projectReport }, { one: demo.description });
  });

  it("collects demographics aggregate virtual fields", async () => {
    collector.addField(getField("pro-pit-volunteers-count"), "projectPitches", "one");
    collector.addField(getField("pro-pit-indirect-beneficiaries-count"), "projectPitches", "two");

    const pitch = await ProjectPitchFactory.create();
    const volDemo = await DemographicFactory.projectPitch(pitch).create({
      type: "volunteers",
      collection: "volunteer"
    });
    // for collection, only gender counts
    await DemographicEntryFactory.create({
      demographicId: volDemo.id,
      type: "gender",
      subtype: "unknown",
      amount: 10
    });
    const beneDemo = await DemographicFactory.projectPitch(pitch).create({
      type: "indirect-beneficiaries",
      collection: "indirect"
    });
    await DemographicEntryFactory.create({
      demographicId: beneDemo.id,
      type: "gender",
      subtype: "unknown",
      amount: 20
    });

    await harness.expectAnswers({ projectPitches: pitch }, { one: 10, two: 20 });
  });

  it("throws in collect if an invalid virtual config is found", async () => {
    const virtual = {
      type: "foo",
      demographicsType: "workdays",
      collection: "paid-other-activities"
    } as unknown as VirtualDemographicsAggregate;
    collector.addField({ virtual, label: "", inputType: "long-text" }, "projectReports", "one");

    await expect(harness.getAnswers({ projectReports: new ProjectReport() })).rejects.toThrow(
      "Unrecognized virtual props type: foo"
    );
  });

  it("syncs property fields", async () => {
    const site = await SiteFactory.create();
    const question = await FormQuestionFactory.section().create({
      inputType: "text",
      linkedFieldKey: "site-history"
    });

    await collector.syncField(site, question, getField("site-history"), {
      [question.uuid]: "site history"
    });
    expect(site.history).toBe("site history");
  });

  describe("demographicsAggregate sync", () => {
    let pitch: ProjectPitch;
    let question: FormQuestion;

    beforeEach(async () => {
      pitch = await ProjectPitchFactory.create();
      question = await FormQuestionFactory.section().create({
        inputType: "number",
        linkedFieldKey: "pro-pit-volunteers-count"
      });
    });

    it("throws if the input is not a positive number", async () => {
      await expect(
        collector.syncField(pitch, question, getField("pro-pit-volunteers-count"), {
          [question.uuid]: "not a number"
        })
      ).rejects.toThrow("Invalid demographics aggregate value: [pro-pit-volunteers-count, not a number]");
      await expect(
        collector.syncField(pitch, question, getField("pro-pit-volunteers-count"), {
          [question.uuid]: -1
        })
      ).rejects.toThrow("Invalid demographics aggregate value: [pro-pit-volunteers-count, -1]");
    });

    it("throws if the demographic already has entries from another input", async () => {
      const demo = await DemographicFactory.projectPitch(pitch).create({
        type: "volunteers",
        collection: "volunteer"
      });
      await DemographicEntryFactory.create({ demographicId: demo.id, type: "gender", subtype: "male", amount: 10 });
      await DemographicEntryFactory.create({ demographicId: demo.id, type: "gender", subtype: "female", amount: 10 });
      await DemographicEntryFactory.create({ demographicId: demo.id, type: "age", subtype: "youth", amount: 5 });
      await expect(
        collector.syncField(pitch, question, getField("pro-pit-volunteers-count"), {
          [question.uuid]: 15
        })
      ).rejects.toThrow(
        "Illegal attempt to update complicated demographics through aggregate accessor. [pro-pit-volunteers-count]"
      );
    });

    it("unhides a hidden demographic", async () => {
      const demo = await DemographicFactory.projectPitch(pitch).create({
        type: "volunteers",
        collection: "volunteer",
        hidden: true
      });
      await DemographicEntryFactory.create({
        demographicId: demo.id,
        type: "gender",
        subtype: "unknown",
        amount: 10
      });
      await DemographicEntryFactory.create({
        demographicId: demo.id,
        type: "age",
        subtype: "unknown",
        amount: 10
      });
      await collector.syncField(pitch, question, getField("pro-pit-volunteers-count"), {
        [question.uuid]: 15
      });
      expect((await demo.reload()).hidden).toBe(false);
    });

    it("updates an existing demographic's entries", async () => {
      const demo = await DemographicFactory.projectPitch(pitch).create({
        type: "volunteers",
        collection: "volunteer"
      });
      const gender = await DemographicEntryFactory.create({
        demographicId: demo.id,
        type: "gender",
        subtype: "unknown",
        amount: 10
      });
      const age = await DemographicEntryFactory.create({
        demographicId: demo.id,
        type: "age",
        subtype: "unknown",
        amount: 10
      });
      await collector.syncField(pitch, question, getField("pro-pit-volunteers-count"), {
        [question.uuid]: 15
      });
      expect((await gender.reload()).amount).toBe(15);
      expect((await age.reload()).amount).toBe(15);
    });

    it("creates a demographic if one does not exist", async () => {
      await collector.syncField(pitch, question, getField("pro-pit-volunteers-count"), {
        [question.uuid]: 15
      });
      const demo = await Demographic.for(pitch).type("volunteers").collection("volunteer").findOne();
      const entries = demo == null ? [] : await DemographicEntry.demographic(demo.id).findAll();
      expect(entries.length).toBe(2);
      expect(entries).toContainEqual(expect.objectContaining({ type: "gender", subtype: "unknown", amount: 15 }));
      expect(entries).toContainEqual(expect.objectContaining({ type: "age", subtype: "unknown", amount: 15 }));
    });

    it("destroys demographics if the value is null", async () => {
      const demo = await DemographicFactory.projectPitch(pitch).create({
        type: "volunteers",
        collection: "volunteer"
      });
      const gender = await DemographicEntryFactory.create({
        demographicId: demo.id,
        type: "gender",
        subtype: "unknown",
        amount: 10
      });
      const age = await DemographicEntryFactory.create({
        demographicId: demo.id,
        type: "age",
        subtype: "unknown",
        amount: 10
      });
      await collector.syncField(pitch, question, getField("pro-pit-volunteers-count"), {
        [question.uuid]: null
      });
      expect((await demo.reload({ paranoid: false })).deletedAt).not.toBeNull();
      expect((await gender.reload({ paranoid: false })).deletedAt).not.toBeNull();
      expect((await age.reload({ paranoid: false })).deletedAt).not.toBeNull();
    });
  });

  describe("demographicsDescription sync", () => {
    let report: ProjectReport;
    let question: FormQuestion;

    beforeEach(async () => {
      report = await ProjectReportFactory.create();
      question = await FormQuestionFactory.section().create({
        inputType: "number",
        linkedFieldKey: "pro-rep-other-workdays-description"
      });
    });

    it("throws if the input is not a string", async () => {
      await expect(
        collector.syncField(report, question, getField("pro-rep-other-workdays-description"), {
          [question.uuid]: 15
        })
      ).rejects.toThrow("Invalid demographics description: [pro-rep-other-workdays-description, 15]");
    });

    it("creates demographics if they don't exists", async () => {
      await collector.syncField(report, question, getField("pro-rep-other-workdays-description"), {
        [question.uuid]: "description"
      });
      const demographics = await Demographic.for(report).type("workdays").findAll();
      expect(demographics.length).toBe(2);
      expect(demographics).toContainEqual(
        expect.objectContaining({ collection: "paid-other-activities", description: "description" })
      );
      expect(demographics).toContainEqual(
        expect.objectContaining({ collection: "volunteer-other-activities", description: "description" })
      );
    });

    it("updates existing demographics", async () => {
      const paid = await DemographicFactory.projectReportWorkday(report).create({
        collection: "paid-other-activities",
        description: "old description"
      });
      await collector.syncField(report, question, getField("pro-rep-other-workdays-description"), {
        [question.uuid]: "new description"
      });
      const demographics = await Demographic.for(report).type("workdays").findAll();
      expect(demographics.length).toBe(2);
      expect(demographics).toContainEqual(
        expect.objectContaining({ id: paid.id, collection: "paid-other-activities", description: "new description" })
      );
      expect(demographics).toContainEqual(
        expect.objectContaining({ collection: "volunteer-other-activities", description: "new description" })
      );
    });

    it("handles a null value", async () => {
      const paid = await DemographicFactory.projectReportWorkday(report).create({
        collection: "paid-other-activities",
        description: "old description"
      });
      await collector.syncField(report, question, getField("pro-rep-other-workdays-description"), {
        [question.uuid]: null
      });
      const demographics = await Demographic.for(report).type("workdays").findAll();
      expect(demographics.length).toBe(1);
      expect(demographics).toContainEqual(
        expect.objectContaining({ id: paid.id, collection: "paid-other-activities", description: null })
      );
    });
  });
});

import { CollectorTestHarness, getRelation } from "./linked-answer-collector.spec";
import {
  DemographicEntryFactory,
  DemographicFactory,
  SiteReportFactory
} from "@terramatch-microservices/database/factories";
import { RelationResourceCollector } from "./index";
import { Demographic, DemographicEntry, SiteReport } from "@terramatch-microservices/database/entities";

describe("DemographicsCollector", () => {
  let harness: CollectorTestHarness;
  let collector: RelationResourceCollector;

  beforeEach(() => {
    harness = new CollectorTestHarness();
    collector = harness.collector.demographics;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("collect", () => {
    it("throws if no collection is defined", () => {
      expect(() =>
        collector.addField({ resource: "demographics", inputType: "workdays", label: "" }, "siteReports", "one")
      ).toThrow("Collection not found for siteReports");
    });

    it("throws if an expected model is not found", async () => {
      collector.addField(getRelation("site-rep-rel-paid-planting"), "siteReports", "one");
      await expect(harness.getAnswers({})).rejects.toThrow("Model for type not found: siteReports");
    });

    it("collects demographics", async () => {
      collector.addField(getRelation("site-rep-rel-paid-planting"), "siteReports", "one");
      collector.addField(getRelation("site-rep-rel-volunteer-other-activities"), "siteReports", "two");

      const siteReport = await SiteReportFactory.create();
      const paidPlanting = await DemographicFactory.siteReportWorkday(siteReport).create({
        collection: "paid-planting"
      });
      await DemographicEntryFactory.create({
        demographicId: paidPlanting.id,
        type: "gender",
        subtype: "unknown",
        name: null,
        amount: 10
      });
      await DemographicEntryFactory.create({
        demographicId: paidPlanting.id,
        type: "age",
        subtype: "unknown",
        name: null,
        amount: 10
      });
      const volunteerOther = await DemographicFactory.siteReportWorkday(siteReport).create({
        collection: "volunteer-other-activities"
      });
      await DemographicEntryFactory.create({
        demographicId: volunteerOther.id,
        type: "gender",
        subtype: "male",
        name: null,
        amount: 10
      });
      await DemographicEntryFactory.create({
        demographicId: volunteerOther.id,
        type: "gender",
        subtype: "female",
        name: null,
        amount: 10
      });
      await DemographicEntryFactory.create({
        demographicId: volunteerOther.id,
        type: "age",
        subtype: "youth",
        name: null,
        amount: 5
      });
      await DemographicEntryFactory.create({
        demographicId: volunteerOther.id,
        type: "age",
        subtype: "elder",
        name: null,
        amount: 15
      });
      await DemographicEntryFactory.create({
        demographicId: volunteerOther.id,
        type: "ethnicity",
        subtype: "indigenous",
        name: "Apache",
        amount: 20
      });

      await harness.expectAnswers(
        { siteReports: siteReport },
        {
          one: [
            expect.objectContaining({
              uuid: paidPlanting.uuid,
              collection: "paid-planting",
              entries: [
                { type: "gender", subtype: "unknown", name: null, amount: 10 },
                { type: "age", subtype: "unknown", name: null, amount: 10 }
              ]
            })
          ],
          two: [
            expect.objectContaining({
              uuid: volunteerOther.uuid,
              collection: "volunteer-other-activities",
              entries: [
                { type: "gender", subtype: "male", name: null, amount: 10 },
                { type: "gender", subtype: "female", name: null, amount: 10 },
                { type: "age", subtype: "youth", name: null, amount: 5 },
                { type: "age", subtype: "elder", name: null, amount: 15 },
                { type: "ethnicity", subtype: "indigenous", name: "Apache", amount: 20 }
              ]
            })
          ]
        }
      );
    });
  });

  describe("sync", () => {
    it("throws if the collection is missing", async () => {
      await expect(
        collector.syncRelation(
          new SiteReport(),
          { inputType: "workdays", label: "", resource: "demographics" },
          undefined,
          false
        )
      ).rejects.toThrow("Collection not found for workdays");
    });

    it("destroys demographics if the value is empty", async () => {
      const siteReport = await SiteReportFactory.create();
      const demographic = await DemographicFactory.siteReportWorkday(siteReport).create({
        collection: "paid-planting"
      });
      await collector.syncRelation(siteReport, getRelation("site-rep-rel-paid-planting"), [], false);
      expect((await demographic.reload({ paranoid: false })).deletedAt).not.toBeNull();
    });

    it("updates hidden", async () => {
      const siteReport = await SiteReportFactory.create();
      const demographic = await DemographicFactory.siteReportWorkday(siteReport).create({
        collection: "paid-planting"
      });
      await collector.syncRelation(siteReport, getRelation("site-rep-rel-paid-planting"), [{}], true);
      await demographic.reload();
      expect(demographic.hidden).toBe(true);
    });

    it("creates demographics", async () => {
      const siteReport = await SiteReportFactory.create();
      await collector.syncRelation(siteReport, getRelation("site-rep-rel-paid-planting"), [{}], false);
      const demo = await Demographic.for(siteReport).type("workdays").collection("paid-planting").findOne();
      expect(demo).toBeDefined();
    });

    it("updates and creates entries", async () => {
      const siteReport = await SiteReportFactory.create();
      const demographic = await DemographicFactory.siteReportWorkday(siteReport).create({
        collection: "paid-planting"
      });
      const gender = await DemographicEntryFactory.create({
        demographicId: demographic.id,
        type: "gender",
        subtype: "unknown",
        amount: 10
      });
      const age = await DemographicEntryFactory.create({
        demographicId: demographic.id,
        type: "age",
        subtype: "youth",
        amount: 10
      });

      const answer = {
        // check to make sure an incorrect collection for the field is ignored
        collection: "volunteer-planting",
        entries: [
          { type: "gender", subtype: "female", amount: 8 },
          { type: "gender", subtype: "male", amount: 2 },
          // check for deduplicating input
          { type: "gender", subtype: "male", amount: 7 },
          { type: "age", subtype: "youth", amount: 2 },
          { type: "age", subtype: "elder", amount: 13 },
          { type: "ethnicity", subtype: "other", amount: 15 }
        ]
      };
      await collector.syncRelation(siteReport, getRelation("site-rep-rel-paid-planting"), [answer], false);

      await demographic.reload();
      await gender.reload({ paranoid: false });
      await age.reload();
      expect(demographic.collection).toBe("paid-planting");
      expect(gender.deletedAt).not.toBeNull();
      expect(age.amount).toBe(2);

      const allEntries = await DemographicEntry.demographic(demographic.id).findAll();
      expect(allEntries.length).toBe(5);
      expect(allEntries).toContainEqual(expect.objectContaining({ type: "gender", subtype: "female", amount: 8 }));
      expect(allEntries).toContainEqual(expect.objectContaining({ type: "gender", subtype: "male", amount: 7 }));
      expect(allEntries).toContainEqual(expect.objectContaining({ type: "age", subtype: "youth", amount: 2 }));
      expect(allEntries).toContainEqual(expect.objectContaining({ type: "age", subtype: "elder", amount: 13 }));
      expect(allEntries).toContainEqual(expect.objectContaining({ type: "ethnicity", subtype: "other", amount: 15 }));
    });
  });
});

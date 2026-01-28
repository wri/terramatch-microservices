import {
  TrackingEntryFactory,
  TrackingFactory,
  ProjectPitchFactory,
  SiteReportFactory
} from "@terramatch-microservices/database/factories";
import { RelationResourceCollector } from "./index";
import { Tracking, TrackingEntry, SiteReport } from "@terramatch-microservices/database/entities";
import { CollectorTestHarness, getRelation } from "../../util/testing";

describe("TrackingsCollector", () => {
  let harness: CollectorTestHarness;
  let collector: RelationResourceCollector;

  describe("demographics domain", () => {
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
        ).toThrow("Invalid tracking field definition [demographics, workdays, undefined]");
      });

      it("throws if an expected model is not found", async () => {
        collector.addField(getRelation("site-rep-rel-paid-planting"), "siteReports", "one");
        await expect(harness.getAnswers({})).rejects.toThrow("Model for type not found: siteReports");
      });

      it("collects demographics", async () => {
        collector.addField(getRelation("pro-pit-all-jobs"), "projectPitches", "one");
        collector.addField(getRelation("pro-pit-all-beneficiaries"), "projectPitches", "two");

        // Create two demographics that use the same collection to test type disambiguation.
        const pitch = await ProjectPitchFactory.create();
        const jobs = await TrackingFactory.projectPitch(pitch).create({
          collection: "all",
          type: "jobs"
        });
        await TrackingEntryFactory.gender(jobs, "unknown").create({ amount: 10 });
        await TrackingEntryFactory.age(jobs, "unknown").create({ amount: 10 });
        const employees = await TrackingFactory.projectPitch(pitch).create({
          collection: "all",
          type: "all-beneficiaries"
        });
        await TrackingEntryFactory.gender(employees, "male").create({ amount: 10 });
        await TrackingEntryFactory.gender(employees, "female").create({ amount: 10 });
        await TrackingEntryFactory.age(employees, "youth").create({ amount: 5 });
        await TrackingEntryFactory.age(employees, "elder").create({ amount: 15 });
        await TrackingEntryFactory.ethnicity(employees, "indigenous", "Apache").create({ amount: 20 });

        await harness.expectAnswers(
          { projectPitches: pitch },
          {
            one: [
              expect.objectContaining({
                uuid: jobs.uuid,
                collection: "all",
                type: "jobs",
                entries: [
                  { type: "gender", subtype: "unknown", name: null, amount: 10 },
                  { type: "age", subtype: "unknown", name: null, amount: 10 }
                ]
              })
            ],
            two: [
              expect.objectContaining({
                uuid: employees.uuid,
                collection: "all",
                type: "all-beneficiaries",
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
        ).rejects.toThrow("Invalid tracking field definition [demographics, workdays, undefined]");
      });

      it("destroys demographics if the value is empty", async () => {
        const siteReport = await SiteReportFactory.create();
        const demographic = await TrackingFactory.siteReportWorkday(siteReport).create({
          collection: "paid-planting"
        });
        await collector.syncRelation(siteReport, getRelation("site-rep-rel-paid-planting"), [], false);
        expect((await demographic.reload({ paranoid: false })).deletedAt).not.toBeNull();
      });

      it("updates hidden", async () => {
        const siteReport = await SiteReportFactory.create();
        const demographic = await TrackingFactory.siteReportWorkday(siteReport).create({
          collection: "paid-planting"
        });
        await collector.syncRelation(siteReport, getRelation("site-rep-rel-paid-planting"), [{}], true);
        await demographic.reload();
        expect(demographic.hidden).toBe(true);
      });

      it("creates demographics", async () => {
        const siteReport = await SiteReportFactory.create();
        await collector.syncRelation(siteReport, getRelation("site-rep-rel-paid-planting"), [{}], false);
        const demo = await Tracking.for(siteReport).type("workdays").collection("paid-planting").findOne();
        expect(demo).toBeDefined();
      });

      it("updates and creates entries", async () => {
        const siteReport = await SiteReportFactory.create();
        const demographic = await TrackingFactory.siteReportWorkday(siteReport).create({
          collection: "paid-planting"
        });
        const gender = await TrackingEntryFactory.gender(demographic, "unknown").create({ amount: 10 });
        const age = await TrackingEntryFactory.age(demographic, "youth").create({ amount: 10 });

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

        await Promise.all([demographic, gender, age].map(model => model.reload({ paranoid: false })));
        expect(demographic.collection).toBe("paid-planting");
        expect(gender.deletedAt).not.toBeNull();
        expect(age.amount).toBe(2);

        const allEntries = await TrackingEntry.tracking(demographic.id).findAll();
        expect(allEntries.length).toBe(5);
        expect(allEntries).toContainEqual(expect.objectContaining({ type: "gender", subtype: "female", amount: 8 }));
        expect(allEntries).toContainEqual(expect.objectContaining({ type: "gender", subtype: "male", amount: 7 }));
        expect(allEntries).toContainEqual(expect.objectContaining({ type: "age", subtype: "youth", amount: 2 }));
        expect(allEntries).toContainEqual(expect.objectContaining({ type: "age", subtype: "elder", amount: 13 }));
        expect(allEntries).toContainEqual(expect.objectContaining({ type: "ethnicity", subtype: "other", amount: 15 }));
      });
    });
  });
});

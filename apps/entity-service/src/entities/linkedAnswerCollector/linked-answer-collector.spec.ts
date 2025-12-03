import { MediaService } from "@terramatch-microservices/common/media/media.service";
import { createMock, DeepMocked } from "@golevelup/ts-jest";
import { FormModels, LinkedAnswerCollector } from "./index";
import {
  DemographicEntryFactory,
  DemographicFactory,
  FinancialReportFactory,
  FormQuestionFactory,
  MediaFactory,
  NurseryFactory,
  POLYGON,
  ProjectPitchFactory,
  ProjectPolygonFactory,
  ProjectReportFactory,
  SiteFactory,
  SiteReportFactory
} from "@terramatch-microservices/database/factories";
import { Dictionary } from "lodash";
import {
  Demographic,
  DemographicEntry,
  FormQuestion,
  Media,
  ProjectPitch,
  ProjectReport
} from "@terramatch-microservices/database/entities";
import { EmbeddedMediaDto } from "../dto/media.dto";
import { getLinkedFieldConfig } from "@terramatch-microservices/common/linkedFields";
import {
  LinkedField,
  LinkedRelation,
  VirtualDemographicsAggregate
} from "@terramatch-microservices/database/constants/linked-fields";
import { faker } from "@faker-js/faker/.";

const getRelation = (key: string) => getLinkedFieldConfig(key)?.field as LinkedRelation;
const getField = (key: string) => getLinkedFieldConfig(key)?.field as LinkedField;

describe("LinkedAnswerCollector", () => {
  let mediaService: DeepMocked<MediaService>;
  let collector: LinkedAnswerCollector;

  beforeEach(() => {
    mediaService = createMock<MediaService>();
    collector = new LinkedAnswerCollector(mediaService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const getAnswers = async (models: FormModels) => {
    const answers: Dictionary<unknown> = {};
    await collector.collect(answers, models);
    return answers;
  };

  const expectAnswers = async (models: FormModels, expected: Dictionary<unknown>) => {
    expect(await getAnswers(models)).toStrictEqual(expected);
  };

  describe("fieldCollector", () => {
    it("collects standard fields", async () => {
      collector.fields.addField(getField("site-name"), "sites", "one");
      collector.fields.addField(getField("nur-name"), "nurseries", "two");
      // Should NOOP in collect().
      collector.fields.addField(getField("pro-name"), "projects", "three");
      collector.fields.addField(getField("site-landscape-community-contribution"), "sites", "four");

      const site = await SiteFactory.create({ landscapeCommunityContribution: faker.lorem.paragraph(2) });
      const nursery = await NurseryFactory.create();
      await expectAnswers(
        { sites: site, nurseries: nursery },
        { one: site.name, two: nursery.name, four: site.landscapeCommunityContribution }
      );
    });

    it("collections polygon fields", async () => {
      collector.fields.addField(getField("pro-pit-proj-boundary"), "projectPitches", "one");

      const pitch = await ProjectPitchFactory.create();
      await ProjectPolygonFactory.forPitch(pitch).create();
      await expectAnswers({ projectPitches: pitch }, { one: POLYGON });
    });

    it("collects demographicsDescription virtual fields", async () => {
      collector.fields.addField(getField("pro-rep-other-workdays-description"), "projectReports", "one");

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

      await expectAnswers({ projectReports: projectReport }, { one: demo.description });
    });

    it("collects demographics aggregate virtual fields", async () => {
      collector.fields.addField(getField("pro-pit-volunteers-count"), "projectPitches", "one");
      collector.fields.addField(getField("pro-pit-indirect-beneficiaries-count"), "projectPitches", "two");

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

      await expectAnswers({ projectPitches: pitch }, { one: 10, two: 20 });
    });

    it("throws in collect if an invalid virtual config is found", async () => {
      const virtual = {
        type: "foo",
        demographicsType: "workdays",
        collection: "paid-other-activities"
      } as unknown as VirtualDemographicsAggregate;
      collector.fields.addField({ virtual, label: "", inputType: "long-text" }, "projectReports", "one");

      await expect(getAnswers({ projectReports: new ProjectReport() })).rejects.toThrow(
        "Unrecognized virtual props type: foo"
      );
    });

    it("syncs property fields", async () => {
      const site = await SiteFactory.create();
      const question = await FormQuestionFactory.section().create({
        inputType: "text",
        linkedFieldKey: "site-history"
      });

      await collector.fields.syncField(site, question, getField("site-history"), { [question.uuid]: "site history" });
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
          collector.fields.syncField(pitch, question, getField("pro-pit-volunteers-count"), {
            [question.uuid]: "not a number"
          })
        ).rejects.toThrow("Invalid demographics aggregate value: [pro-pit-volunteers-count, not a number]");
        await expect(
          collector.fields.syncField(pitch, question, getField("pro-pit-volunteers-count"), {
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
          collector.fields.syncField(pitch, question, getField("pro-pit-volunteers-count"), {
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
        await DemographicEntryFactory.create({ demographicId: demo.id, type: "age", subtype: "unknown", amount: 10 });
        await collector.fields.syncField(pitch, question, getField("pro-pit-volunteers-count"), {
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
        await collector.fields.syncField(pitch, question, getField("pro-pit-volunteers-count"), {
          [question.uuid]: 15
        });
        expect((await gender.reload()).amount).toBe(15);
        expect((await age.reload()).amount).toBe(15);
      });

      it("creates a demographic if one does not exist", async () => {
        await collector.fields.syncField(pitch, question, getField("pro-pit-volunteers-count"), {
          [question.uuid]: 15
        });
        const demo = await Demographic.for(pitch).type("volunteers").collection("volunteer").findOne();
        const entries = demo == null ? [] : await DemographicEntry.demographic(demo.id).findAll();
        expect(entries.length).toBe(2);
        expect(entries).toContainEqual(expect.objectContaining({ type: "gender", subtype: "unknown", amount: 15 }));
        expect(entries).toContainEqual(expect.objectContaining({ type: "age", subtype: "unknown", amount: 15 }));
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
          collector.fields.syncField(report, question, getField("pro-rep-other-workdays-description"), {
            [question.uuid]: 15
          })
        ).rejects.toThrow("Invalid demographics description: [pro-rep-other-workdays-description, 15]");
      });

      it("creates demographics if they don't exists", async () => {
        await collector.fields.syncField(report, question, getField("pro-rep-other-workdays-description"), {
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
        await collector.fields.syncField(report, question, getField("pro-rep-other-workdays-description"), {
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
    });
  });

  describe("fileCollector", () => {
    it("throws if a model is not a media owner", async () => {
      collector.files.addField({ collection: "media", label: "", inputType: "file" }, "financialReports", "one");
      await expect(getAnswers({ financialReports: await FinancialReportFactory.create() })).rejects.toThrow(
        "Entity is not a media owner: financialReports"
      );
    });

    it("throws if the configuration is not found", async () => {
      collector.files.addField({ collection: "dancingLlamas", label: "", inputType: "file" }, "sites", "one");
      await expect(getAnswers({ sites: await SiteFactory.create() })).rejects.toThrow(
        "Media configuration not found: [sites, dancingLlamas]"
      );
    });

    it("collects files", async () => {
      collector.files.addField({ collection: "media", label: "", inputType: "file" }, "sites", "one");
      // should overwrite the first field
      collector.files.addField({ collection: "media", label: "", inputType: "file" }, "sites", "two");
      collector.files.addField({ collection: "media", label: "", inputType: "file" }, "nurseries", "three");
      collector.files.addField({ collection: "file", label: "", inputType: "file" }, "nurseries", "four");
      collector.files.addField({ collection: "photos", label: "", inputType: "file" }, "sites", "five");
      collector.files.addField(
        { collection: "stratification_for_heterogeneity", label: "", inputType: "file" },
        "sites",
        "six"
      );

      mediaService.getUrl.mockReturnValue("");
      const createDto = (media: Media) => new EmbeddedMediaDto(media, { url: "", thumbUrl: "" });

      const site = await SiteFactory.create();
      const siteMedia = await Promise.all([
        MediaFactory.forSite(site).create({ collectionName: "media", orderColumn: 1 }),
        MediaFactory.forSite(site).create({ collectionName: "media", orderColumn: 2 })
      ]);
      // ignored by collect()
      await MediaFactory.forSite(site).create({ collectionName: "otherAdditionalDocuments" });
      // only the first file is collected
      const heterogeneity = await Promise.all([
        MediaFactory.forSite(site).create({ collectionName: "stratification_for_heterogeneity", orderColumn: 0 }),
        MediaFactory.forSite(site).create({ collectionName: "stratification_for_heterogeneity", orderColumn: 1 })
      ]);
      const nursery = await NurseryFactory.create();
      const nurseryMedia = await MediaFactory.forNursery(nursery).create({ collectionName: "media" });
      const nurseryFile = await MediaFactory.forNursery(nursery).create({ collectionName: "file" });
      // reload all the media so the DTOs match
      await Promise.all([...siteMedia, ...heterogeneity, nurseryMedia, nurseryFile].map(media => media.reload()));
      await expectAnswers(
        { sites: site, nurseries: nursery },
        {
          two: siteMedia.map(createDto),
          three: [createDto(nurseryMedia)],
          four: [createDto(nurseryFile)],
          five: undefined,
          six: createDto(heterogeneity[0])
        }
      );
    });
  });

  describe("demographicsCollector", () => {
    it("throws if no collection is defined", () => {
      expect(() =>
        collector.demographics.addField(
          { resource: "demographics", inputType: "workdays", label: "" },
          "siteReports",
          "one"
        )
      ).toThrow("Collection not found for siteReports");
    });

    it("throws if an expected model is not found", async () => {
      collector.demographics.addField(getRelation("site-rep-rel-paid-planting"), "siteReports", "one");
      await expect(getAnswers({})).rejects.toThrow("Model for type not found: siteReports");
    });

    it("collects demographics", async () => {
      collector.demographics.addField(getRelation("site-rep-rel-paid-planting"), "siteReports", "one");
      collector.demographics.addField(getRelation("site-rep-rel-volunteer-other-activities"), "siteReports", "two");

      const siteReport = await SiteReportFactory.create();
      const paidPlanting = await DemographicFactory.siteReportWorkday(siteReport).create({
        collection: "paid-planting"
      });
      const volunteerOther = await DemographicFactory.siteReportWorkday(siteReport).create({
        collection: "volunteer-other-activities"
      });

      // TODO: putting a pin in this as I discovered some major shortfalls in the current field collector I need to address.
    });
  });
});

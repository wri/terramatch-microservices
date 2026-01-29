import { FieldsApprovalProcessor } from "./fields.approval-processor";
import { Disturbance, FinancialIndicator, Form, FundingType } from "@terramatch-microservices/database/entities";
import {
  TrackingEntryFactory,
  TrackingFactory,
  DisturbanceFactory,
  DisturbanceReportEntryFactory,
  DisturbanceReportFactory,
  EntityFormFactory,
  FinancialIndicatorFactory,
  FinancialReportFactory,
  FormQuestionFactory,
  FormSectionFactory,
  FundingTypeFactory,
  InvasiveFactory,
  MediaFactory,
  OrganisationFactory,
  ProjectFactory,
  SeedingFactory,
  SiteFactory,
  SitePolygonFactory,
  StratasFactory,
  TreeSpeciesFactory
} from "@terramatch-microservices/database/factories";
import { createMock, DeepMocked } from "@golevelup/ts-jest";
import { MediaService } from "../../media/media.service";
import { EntityModel } from "@terramatch-microservices/database/constants/entities";
import { APPROVED } from "@terramatch-microservices/database/constants/status";
import { HiddenRelationsApprovalProcessor } from "./hidden-relations.approval-processor";
import { FundingTypeApprovalProcessor } from "./funding-type.approval-processor";
import { FinancialIndicatorApprovalProcessor } from "./financial-indicator.approval-processor";
import { DisturbanceReportEntryApprovalProcessor } from "./disturbance-report-entry.approval-processor";
import { faker } from "@faker-js/faker";
import { DateTime } from "luxon";

describe("EntityApprovalProcessor", () => {
  let mediaService: DeepMocked<MediaService>;

  beforeEach(() => {
    mediaService = createMock<MediaService>();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("fields processor", () => {
    const process = (entity: EntityModel) => FieldsApprovalProcessor.processEntityApproval(entity, mediaService);

    it("NOOPs if the form isn't found", async () => {
      await Form.truncate();
      await expect(process(await ProjectFactory.create())).resolves.toBeUndefined();
    });

    it("nulls out hidden fields", async () => {
      const project = await ProjectFactory.create({
        name: "Test Project",
        descriptionOfProjectTimeline: "Test Description",
        status: APPROVED
      });
      await Form.truncate();
      const form = await EntityFormFactory.project(project).create();
      const section = await FormSectionFactory.form(form).create();
      await FormQuestionFactory.section(section).create({ linkedFieldKey: "pro-name" });
      const conditional = await FormQuestionFactory.section(section).create({ inputType: "conditional" });
      await FormQuestionFactory.section(section).create({
        linkedFieldKey: "pro-desc-of-proj-timeline",
        parentId: conditional.uuid,
        showOnParentCondition: true
      });
      await project.update({ answers: { [conditional.uuid]: false } });
      await process(project);
      expect(project.name).toBe("Test Project");
      expect(project.descriptionOfProjectTimeline).toBeNull();
    });
  });

  describe("hidden relations processor", () => {
    const process = (entity: EntityModel) =>
      HiddenRelationsApprovalProcessor.processEntityApproval(entity, mediaService);

    it("removes hidden relations", async () => {
      const site = await SiteFactory.create({ status: APPROVED });
      const demographic = await TrackingFactory.siteWorkday(site).create({ hidden: true });
      const entry = await TrackingEntryFactory.any(demographic).create();
      const tree = await TreeSpeciesFactory.siteTreePlanted(site).create({ hidden: true });
      // Spot check one model to make sure visible records are unaffected
      const visibleTree = await TreeSpeciesFactory.siteTreePlanted(site).create();
      const disturbance = await DisturbanceFactory.site(site).create({ hidden: true });
      const invasive = await InvasiveFactory.site(site).create({ hidden: true });
      const seeding = await SeedingFactory.site(site).create({ hidden: true });
      const strata = await StratasFactory.site(site).create({ hidden: true });

      await process(site);

      const hidden = [demographic, entry, tree, disturbance, invasive, seeding, strata];
      await Promise.all([visibleTree, ...hidden].map(model => model.reload({ paranoid: false })));
      expect(hidden.find(({ deletedAt }) => deletedAt == null)).toBeUndefined();
      expect(visibleTree.deletedAt).toBeNull();
    });
  });

  describe("funding type processor", () => {
    const process = (entity: EntityModel) => FundingTypeApprovalProcessor.processEntityApproval(entity, mediaService);

    it("NOOPs if the entity is not a financial report", async () => {
      const project = await ProjectFactory.create();
      await expect(process(project)).resolves.toBeUndefined();
    });

    it("NOOPs if the org is not found", async () => {
      const org = await OrganisationFactory.create();
      const report = await FinancialReportFactory.org(org).create();
      await org.destroy();
      await expect(process(report)).resolves.toBeUndefined();
    });

    it("replaces org funding types with copies from the report", async () => {
      const org = await OrganisationFactory.create();
      const orgFundingTypes = await FundingTypeFactory.org(org).createMany(3);

      const report = await FinancialReportFactory.org(org).create({ status: APPROVED });
      const reportFundingTypes = await FundingTypeFactory.report(report).createMany(2);

      await process(report);
      await Promise.all([...orgFundingTypes, ...reportFundingTypes].map(model => model.reload({ paranoid: false })));
      // all old org funding types are blown away
      expect(orgFundingTypes.find(({ deletedAt }) => deletedAt == null)).toBeUndefined();
      // report funding types are left alone
      expect(reportFundingTypes.find(({ deletedAt }) => deletedAt != null)).toBeUndefined();

      const allOrgFundingTypes = await FundingType.organisation(org.uuid).findAll();
      expect(allOrgFundingTypes.length).toBe(reportFundingTypes.length);
      for (const { source, amount, year, type } of reportFundingTypes) {
        expect(allOrgFundingTypes).toContainEqual(expect.objectContaining({ source, amount, year, type }));
      }
    });
  });

  describe("financial indicator processor", () => {
    const process = (entity: EntityModel) =>
      FinancialIndicatorApprovalProcessor.processEntityApproval(entity, mediaService);

    it("NOOPs if the entity is not a financial report", async () => {
      const project = await ProjectFactory.create();
      await expect(process(project)).resolves.toBeUndefined();
    });

    it("NOOPs if the org is not found", async () => {
      const org = await OrganisationFactory.create();
      const report = await FinancialReportFactory.org(org).create();
      await org.destroy();
      await expect(process(report)).resolves.toBeUndefined();
    });

    it("syncs indicator fields from the report to the org", async () => {
      const org = await OrganisationFactory.create({ finStartMonth: 11, currency: "EUR" });
      const orgIndicators = [
        await FinancialIndicatorFactory.org(org).create({ collection: "foo", year: 2020 }),
        await FinancialIndicatorFactory.org(org).create({ collection: "baz", year: 2021 })
      ];

      const report = await FinancialReportFactory.org(org).create({
        finStartMonth: 12,
        currency: "USD",
        status: APPROVED
      });
      const reportIndicators = [
        await FinancialIndicatorFactory.report(report).create({ collection: "foo", year: 2020 }),
        await FinancialIndicatorFactory.report(report).create({ collection: "bar", year: 2021 }),
        await FinancialIndicatorFactory.report(report).create({ collection: "baz", year: 2022 })
      ];

      await process(report);
      await org.reload();
      await Promise.all([...orgIndicators, ...reportIndicators].map(model => model.reload({ paranoid: false })));
      const allOrgIndicators = await FinancialIndicator.organisation(org.id).findAll();

      expect(org.finStartMonth).toBe(12);
      expect(org.currency).toBe("USD");
      expect(orgIndicators[0].deletedAt).toBeNull();
      expect(orgIndicators[1].deletedAt).not.toBeNull();
      expect(allOrgIndicators.length).toBe(reportIndicators.length);
      for (const { year, collection, amount, description, exchangeRate } of reportIndicators) {
        expect(allOrgIndicators).toContainEqual(
          expect.objectContaining({ collection, year, amount, description, exchangeRate })
        );
      }
    });

    it("copies report documentation to the org", async () => {
      const org = await OrganisationFactory.create();
      const orgIndicator = await FinancialIndicatorFactory.org(org).create();
      const orgMedia = await MediaFactory.financialIndicator(orgIndicator).create({ collectionName: "documentation" });

      const report = await FinancialReportFactory.org(org).create({ status: APPROVED });
      const reportIndicator = await FinancialIndicatorFactory.report(report).create({
        year: orgIndicator.year,
        collection: orgIndicator.collection
      });
      const indicatorMedia = [
        await MediaFactory.financialIndicator(reportIndicator).create({
          fileName: orgMedia.fileName,
          size: orgMedia.size,
          collectionName: "documentation"
        }),
        await MediaFactory.financialIndicator(reportIndicator).create({ collectionName: "documentation" })
      ];

      await process(report);

      expect(mediaService.duplicateMedia).toHaveBeenCalledTimes(1);
      expect(mediaService.duplicateMedia).toHaveBeenCalledWith(
        expect.objectContaining({ id: indicatorMedia[1].id }),
        expect.objectContaining({ id: orgIndicator.id })
      );
    });
  });

  describe("disturbance report entry processor", () => {
    const process = (entity: EntityModel) =>
      DisturbanceReportEntryApprovalProcessor.processEntityApproval(entity, mediaService);

    it("NOOPs if the entity is not a disturbance report", async () => {
      const project = await ProjectFactory.create();
      await expect(process(project)).resolves.toBeUndefined();
    });

    it("NOOPs if there are no affected polygons", async () => {
      const report = await DisturbanceReportFactory.create();
      await expect(process(report)).resolves.toBeUndefined();
    });

    it("creates a disturbance and updates affected polygons", async () => {
      const report = await DisturbanceReportFactory.create({
        description: faker.lorem.sentence(),
        actionDescription: faker.lorem.sentence()
      });
      const polygon = await SitePolygonFactory.create({ isActive: true });
      await DisturbanceReportEntryFactory.report(report).create({ name: "intensity", value: "high" });
      await DisturbanceReportEntryFactory.report(report).create({ name: "extent", value: "81-100" });
      await DisturbanceReportEntryFactory.report(report).create({ name: "disturbance-type", value: "climatic" });
      await DisturbanceReportEntryFactory.report(report).create({
        name: "disturbance-subtype",
        value: '["flooding"]'
      });
      await DisturbanceReportEntryFactory.report(report).create({ name: "people-affected", value: "1000" });
      await DisturbanceReportEntryFactory.report(report).create({ name: "monetary-damage", value: "5000" });
      await DisturbanceReportEntryFactory.report(report).create({
        name: "property-affected",
        value: '["seedlings","saplings"]'
      });
      const date = DateTime.now().minus({ weeks: 3 }).set({ millisecond: 0 }).toJSDate();
      await DisturbanceReportEntryFactory.report(report).create({
        name: "date-of-disturbance",
        value: date.toISOString()
      });
      await DisturbanceReportEntryFactory.report(report).create({
        name: "polygon-affected",
        value: `[[{"polyUuid":"${polygon.uuid}"}]]`
      });

      await process(report);

      const disturbances = await Disturbance.for(report).findAll();
      expect(disturbances.length).toBe(1);
      expect(disturbances[0]).toMatchObject({
        description: report.description,
        actionDescription: report.actionDescription,
        intensity: "high",
        extent: "81-100",
        type: "climatic",
        subtype: ["flooding"],
        peopleAffected: 1000,
        monetaryDamage: 5000,
        propertyAffected: ["seedlings", "saplings"],
        disturbanceDate: date
      });

      await polygon.reload();
      expect(polygon.disturbanceId).toBe(disturbances[0].id);
    });
  });
});

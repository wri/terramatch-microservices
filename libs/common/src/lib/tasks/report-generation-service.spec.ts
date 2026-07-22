/* eslint-disable @typescript-eslint/no-non-null-assertion */
import {
  FinancialIndicatorFactory,
  FinancialReportFactory,
  FundingTypeFactory,
  MediaFactory,
  NurseryFactory,
  OrganisationFactory,
  ProjectFactory,
  SiteFactory,
  TaskFactory
} from "@terramatch-microservices/database/factories";
import { ReportGenerationService } from "./report-generation-service";
import { Test } from "@nestjs/testing";
import { createMock, DeepMocked } from "@golevelup/ts-jest";
import {
  Action,
  FinancialIndicator,
  FinancialReport,
  FundingType,
  Project,
  Task
} from "@terramatch-microservices/database/entities";
import { NotFoundException } from "@nestjs/common";
import { DateTime } from "luxon";
import { uniq } from "lodash";
import { MediaService } from "../media/media.service";
import { NO_UPDATE } from "@terramatch-microservices/database/constants/status";

describe("ReportGenerationService", () => {
  let service: ReportGenerationService;
  let mediaService: DeepMocked<MediaService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        ReportGenerationService,
        { provide: MediaService, useValue: (mediaService = createMock<MediaService>()) }
      ]
    }).compile();

    service = module.get(ReportGenerationService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("createTask", () => {
    it("should return early if the described task already exists", async () => {
      const { projectId, dueAt } = await TaskFactory.create();
      const createSpy = jest.spyOn(Task, "create");
      await service.createTask(projectId!, dueAt);
      expect(createSpy).not.toHaveBeenCalled();
    });

    it("should throw if the project is not found", async () => {
      await expect(service.createTask(-1, new Date())).rejects.toThrow(NotFoundException);
    });

    it("should succeed if the project has no sites or nurseries", async () => {
      const { id: projectId, frameworkKey } = await ProjectFactory.create();
      const dueAt = DateTime.now().set({ millisecond: 0 }).toJSDate();
      await service.createTask(projectId, dueAt);
      const task = await Task.findOne({ where: { projectId } });
      expect(task).toBeDefined();
      const projectReport = await task!.$get("projectReport");
      expect(projectReport?.projectId).toBe(projectId);
      expect(projectReport?.dueAt).toEqual(dueAt);
      expect(projectReport?.status).toBe("due");
      expect(projectReport?.frameworkKey).toBe(frameworkKey);
    });

    it("should create reports for each site and nursery", async () => {
      const { id: projectId } = await ProjectFactory.create();
      const siteIds = (await SiteFactory.createMany(5, { projectId, status: "approved" })).map(({ id }) => id).sort();
      const nurseryIds = (await NurseryFactory.createMany(3, { projectId, status: "approved" }))
        .map(({ id }) => id)
        .sort();
      const dueAt = DateTime.now().set({ millisecond: 0 }).toJSDate();
      await service.createTask(projectId, dueAt);
      const task = await Task.findOne({ where: { projectId } });
      expect(task).toBeDefined();
      expect((await task!.$get("projectReport"))?.projectId).toBe(projectId);
      const siteReports = await task!.$get("siteReports");
      const siteReportSiteIds = siteReports.map(({ siteId }) => siteId).sort();
      const siteReportsDueAt = siteReports.map(({ dueAt }) => dueAt);
      const siteReportsStatus = uniq(siteReports.map(({ status }) => status));
      expect(siteReportSiteIds).toEqual(siteIds);
      expect(siteReportsDueAt).toEqual([dueAt, dueAt, dueAt, dueAt, dueAt]);
      expect(siteReportsStatus).toEqual(["due"]);
      const nurseryReports = await task!.$get("nurseryReports");
      const nurseryReportNurseryIds = nurseryReports.map(({ nurseryId }) => nurseryId).sort();
      const nurseryReportsDueAt = nurseryReports.map(({ dueAt }) => dueAt);
      const nurseryReportsStatus = uniq(nurseryReports.map(({ status }) => status));
      expect(nurseryReportNurseryIds).toEqual(nurseryIds);
      expect(nurseryReportsDueAt).toEqual([dueAt, dueAt, dueAt]);
      expect(nurseryReportsStatus).toEqual(["due"]);
    });

    it("should create an action for the project report", async () => {
      const { id: projectId, organisationId } = await ProjectFactory.create();
      await service.createTask(projectId, new Date());
      const task = await Task.findOne({ where: { projectId } });
      const projectReport = await task!.$get("projectReport");
      const action = await Action.for(projectReport!).findOne();
      expect(action).toMatchObject({
        status: "pending",
        type: "notification",
        title: "Project report",
        text: "Project report available",
        projectId,
        organisationId
      });
    });

    it("should create an SRP report on the same task as project and site reports for January PPC dues", async () => {
      const { id: projectId, organisationId } = await ProjectFactory.create({ frameworkKey: "ppc" });
      const siteIds = (await SiteFactory.createMany(2, { projectId, status: "approved" })).map(({ id }) => id).sort();
      const dueAt = DateTime.utc(2027, 1, 7).toJSDate();
      await service.createTask(projectId, dueAt);

      const task = await Task.findOne({ where: { projectId } });
      expect(task).toBeDefined();
      expect((await task!.$get("projectReport"))?.projectId).toBe(projectId);

      const siteReports = await task!.$get("siteReports");
      expect(siteReports.map(({ siteId }) => siteId).sort()).toEqual(siteIds);

      const srpReports = await task!.$get("srpReports");
      expect(srpReports).toHaveLength(1);
      expect(srpReports![0]).toMatchObject({
        projectId,
        frameworkKey: "ppc",
        status: "due",
        dueAt,
        year: 2027,
        taskId: task!.id
      });

      const action = await Action.for(srpReports![0]).findOne();
      expect(action).toMatchObject({
        status: "pending",
        type: "notification",
        title: "Srp report",
        text: "Annual Socioeconomic Restoration Partners Report available",
        projectId,
        organisationId
      });
    });

    it("should not create an SRP report for non-January PPC dues", async () => {
      const { id: projectId } = await ProjectFactory.create({ frameworkKey: "ppc" });
      await service.createTask(projectId, DateTime.utc(2027, 4, 3).toJSDate());
      const task = await Task.findOne({ where: { projectId } });
      expect(await task!.$get("srpReports")).toHaveLength(0);
    });
  });

  describe("createFinancialReport", () => {
    beforeEach(async () => {
      await FinancialReport.truncate();
      await FinancialIndicator.truncate();
      await FundingType.truncate();
      await Project.truncate({ cascade: true });
    });

    it("should create a financial report for an organisation with due_at on July 30", async () => {
      const org = await OrganisationFactory.create({ finStartMonth: 4, currency: "USD" });
      await ProjectFactory.create({ organisationId: org.id, frameworkKey: "enterprises", status: "approved" });

      const dueAt = DateTime.utc(2027, 7, 30).toJSDate();
      const report = await service.createFinancialReport(org.id, dueAt);

      expect(report).toMatchObject({
        organisationId: org.id,
        yearOfReport: 2027,
        frameworkKey: "enterprises",
        status: "due",
        updateRequestStatus: NO_UPDATE,
        finStartMonth: 4,
        currency: "USD"
      });
      expect(report?.dueAt).toEqual(DateTime.utc(2027, 7, 30).toJSDate());
    });

    it("should clone org financial indicators, funding types, and documentation media", async () => {
      const org = await OrganisationFactory.create();
      await ProjectFactory.create({ organisationId: org.id, frameworkKey: "enterprises", status: "approved" });
      const orgIndicator = await FinancialIndicatorFactory.org(org).create({
        year: 2026,
        collection: "financial-collection",
        amount: 1000
      });
      await MediaFactory.financialIndicator(orgIndicator).create({ collectionName: "documentation" });
      await FundingTypeFactory.org(org).create({ year: 2026, amount: 5000, type: "grant" });

      const report = await service.createFinancialReport(org.id, DateTime.utc(2027, 7, 30).toJSDate());

      const reportIndicators = await FinancialIndicator.financialReport(report!.id).findAll();
      expect(reportIndicators).toHaveLength(1);
      expect(reportIndicators[0]).toMatchObject({
        year: 2026,
        collection: "financial-collection",
        amount: 1000,
        organisationId: org.id
      });

      const reportFundingTypes = await FundingType.financialReport(report!.id).findAll();
      expect(reportFundingTypes).toHaveLength(1);
      expect(reportFundingTypes[0]).toMatchObject({
        year: 2026,
        amount: 5000,
        type: "grant",
        organisationId: org.uuid
      });

      expect(mediaService.duplicateMedia).toHaveBeenCalledTimes(1);
    });

    it("should throw if the organisation has no eligible project", async () => {
      const org = await OrganisationFactory.create();
      await ProjectFactory.create({ organisationId: org.id, frameworkKey: "ppc", status: "approved" });

      await expect(service.createFinancialReport(org.id, DateTime.utc(2027, 7, 30).toJSDate())).rejects.toThrow(
        NotFoundException
      );
    });

    it("should create another report even if one already exists for the year", async () => {
      const org = await OrganisationFactory.create();
      await ProjectFactory.create({ organisationId: org.id, frameworkKey: "enterprises", status: "approved" });
      await FinancialReportFactory.org(org).create({ yearOfReport: 2027 });

      const report = await service.createFinancialReport(org.id, DateTime.utc(2027, 7, 30).toJSDate());

      expect(report).not.toBeNull();
      expect(await FinancialReport.count({ where: { organisationId: org.id, yearOfReport: 2027 } })).toBe(2);
    });
  });

  describe("createFinancialReports", () => {
    beforeEach(async () => {
      await FinancialReport.truncate();
      await Project.truncate({ cascade: true });
    });

    it("should noop for frameworks without financial reports", async () => {
      const createSpy = jest.spyOn(FinancialReport, "create");
      await service.createFinancialReports("ppc", DateTime.utc(2027, 1, 31).toJSDate());
      expect(createSpy).not.toHaveBeenCalled();
    });

    it("should noop for non-January report periods", async () => {
      const createSpy = jest.spyOn(FinancialReport, "create");
      await service.createFinancialReports("enterprises", DateTime.utc(2027, 7, 30).toJSDate());
      expect(createSpy).not.toHaveBeenCalled();
    });

    it("should create a financial report per organisation with due_at on July 30", async () => {
      const org1 = await OrganisationFactory.create({ finStartMonth: 4, currency: "USD" });
      const org2 = await OrganisationFactory.create();
      await ProjectFactory.create({ organisationId: org1.id, frameworkKey: "enterprises", status: "approved" });
      await ProjectFactory.create({ organisationId: org2.id, frameworkKey: "enterprises", status: "approved" });
      await ProjectFactory.create({ organisationId: org2.id, frameworkKey: "enterprises", status: "approved" });

      await service.createFinancialReports("enterprises", DateTime.utc(2027, 1, 31).toJSDate());

      const reports = await FinancialReport.findAll({
        where: { organisationId: [org1.id, org2.id] },
        order: [["organisationId", "ASC"]]
      });
      expect(reports).toHaveLength(2);
      expect(reports[0]).toMatchObject({
        organisationId: org1.id,
        yearOfReport: 2027,
        frameworkKey: "enterprises",
        status: "due",
        finStartMonth: 4,
        currency: "USD"
      });
      expect(reports[0]?.dueAt).toEqual(DateTime.utc(2027, 7, 30).toJSDate());
      expect(reports[1]?.organisationId).toBe(org2.id);
    });

    it("should create a report even if one already exists for the year", async () => {
      const org = await OrganisationFactory.create();
      await ProjectFactory.create({ organisationId: org.id, frameworkKey: "terrafund-landscapes", status: "approved" });
      await FinancialReportFactory.org(org).create({ yearOfReport: 2027 });

      await service.createFinancialReports("terrafund-landscapes", DateTime.utc(2027, 1, 31).toJSDate());

      expect(await FinancialReport.count({ where: { organisationId: org.id, yearOfReport: 2027 } })).toBe(2);
    });

    it("should not create reports for projects in started status", async () => {
      const org = await OrganisationFactory.create();
      await ProjectFactory.create({ organisationId: org.id, frameworkKey: "enterprises", status: "started" });

      await service.createFinancialReports("enterprises", DateTime.utc(2027, 1, 31).toJSDate());

      expect(await FinancialReport.count({ where: { organisationId: org.id } })).toBe(0);
    });
  });
});

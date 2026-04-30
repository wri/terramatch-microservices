/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { SiteReport } from "@terramatch-microservices/database/entities";
import { DeepMocked } from "@golevelup/ts-jest";
import { EntitiesService } from "../entities.service";
import { Dictionary, reverse, sortBy, sum } from "lodash";
import { EntityQueryDto } from "../dto/entity-query.dto";
import {
  EntityFormFactory,
  OrganisationFactory,
  ProjectFactory,
  ProjectReportFactory,
  ProjectUserFactory,
  SeedingFactory,
  SiteFactory,
  SiteReportFactory,
  TaskFactory,
  TreeSpeciesFactory
} from "@terramatch-microservices/database/factories";
import { BadRequestException } from "@nestjs/common/exceptions/bad-request.exception";
import { DateTime } from "luxon";
import { SiteReportProcessor } from "./site-report.processor";
import { PolicyService } from "@terramatch-microservices/common";
import { buildJsonApi } from "@terramatch-microservices/common/util";
import { SiteReportLightDto } from "../dto/site-report.dto";
import { mockEntityService } from "./entity.processor.spec";
import { CsvExportService } from "@terramatch-microservices/common/export/csv-export.service";
import { setMockedPermissions } from "@terramatch-microservices/common/util/testing";
import { TestingModule } from "@nestjs/testing";
import { Response } from "express";
import { InternalServerErrorException, NotFoundException } from "@nestjs/common";

describe("SiteReportProcessor", () => {
  let module: TestingModule;
  let processor: SiteReportProcessor;

  const policyService = () => module.get(PolicyService);
  const csvExportService = (): DeepMocked<CsvExportService> => module.get(CsvExportService);
  const entitiesService = () => module.get(EntitiesService);

  beforeEach(async () => {
    await SiteReport.truncate();

    module = await mockEntityService();
    processor = module.get(EntitiesService).createEntityProcessor("siteReports") as SiteReportProcessor;
  });

  describe("findMany", () => {
    async function expectSiteReports(
      expected: SiteReport[],
      query: Omit<EntityQueryDto, "field" | "direction" | "size" | "number">,
      {
        permissions = [],
        sortField = "id",
        sortUp = true,
        total = expected.length
      }: { permissions?: string[]; sortField?: string; sortUp?: boolean; total?: number } = {}
    ) {
      setMockedPermissions(...permissions);
      const { models, paginationTotal } = await processor.findMany(query as EntityQueryDto);
      expect(models.length).toBe(expected.length);
      expect(paginationTotal).toBe(total);

      const sorted = sortBy(expected, sortField);
      if (!sortUp) reverse(sorted);
      expect(models.map(({ id }) => id)).toEqual(sorted.map(({ id }) => id));
    }

    it("should returns site reports", async () => {
      const project = await ProjectFactory.create();
      const site = await SiteFactory.create({ projectId: project.id });
      await ProjectUserFactory.create({ userId: policyService().userId, projectId: project.id });
      const managedSiteReports = await SiteReportFactory.createMany(3, { siteId: site.id });
      await SiteReportFactory.createMany(5);
      await expectSiteReports(managedSiteReports, {}, { permissions: ["manage-own"] });
    });

    it("should returns managed site reports", async () => {
      const project = await ProjectFactory.create();
      await ProjectUserFactory.create({
        userId: policyService().userId,
        projectId: project.id,
        isMonitoring: false,
        isManaging: true
      });
      await ProjectFactory.create();
      const site = await SiteFactory.create({ projectId: project.id });
      const siteReports = await SiteReportFactory.createMany(3, { siteId: site.id });
      await SiteReportFactory.createMany(5);
      await expectSiteReports(siteReports, {}, { permissions: ["projects-manage"] });
    });

    it("should returns framework site reports", async () => {
      const siteReports = await SiteReportFactory.createMany(3, { frameworkKey: "hbf" });
      await SiteReportFactory.createMany(3, { frameworkKey: "ppc" });
      for (const p of await SiteReportFactory.createMany(3, { frameworkKey: "terrafund" })) {
        siteReports.push(p);
      }

      await expectSiteReports(siteReports, {}, { permissions: ["framework-hbf", "framework-terrafund"] });
    });

    it("should return site reports that match the search term", async () => {
      const org1 = await OrganisationFactory.create({ name: "A Org" });
      const org2 = await OrganisationFactory.create({ name: "B Org" });
      const project1 = await ProjectFactory.create({ name: "Foo Bar", organisationId: org1.id });
      const project2 = await ProjectFactory.create({ name: "Baz Foo", organisationId: org2.id });
      const site1 = await SiteFactory.create({ projectId: project1.id, name: "A Site" });
      const site2 = await SiteFactory.create({ projectId: project2.id, name: "Site B" });
      site1.project = await site1.$get("project");
      site2.project = await site2.$get("project");
      const siteReport1 = await SiteReportFactory.create({ siteId: site1.id });
      const siteReport2 = await SiteReportFactory.create({ siteId: site2.id });
      siteReport1.site = await siteReport1.$get("site");
      siteReport2.site = await siteReport2.$get("site");
      await SiteReportFactory.createMany(3);

      await expectSiteReports([siteReport1, siteReport2], { search: "foo" });

      await expectSiteReports([siteReport1, siteReport2], { search: "org" });

      await expectSiteReports([siteReport1, siteReport2], { search: "site" });
    });

    it("should return site reports filtered by the update request status, country, site and project", async () => {
      const p1 = await ProjectFactory.create({ country: "MX" });
      const p2 = await ProjectFactory.create({ country: "CA" });
      await ProjectUserFactory.create({ userId: policyService().userId, projectId: p1.id });
      await ProjectUserFactory.create({ userId: policyService().userId, projectId: p2.id });
      const s1 = await SiteFactory.create({ projectId: p1.id });
      const s2 = await SiteFactory.create({ projectId: p2.id });
      s1.project = await s1.$get("project");
      s2.project = await s2.$get("project");
      const first = await SiteReportFactory.create({
        title: "first site report",
        status: "approved",
        updateRequestStatus: "awaiting-approval",
        frameworkKey: "ppc",
        siteId: s1.id
      });
      const second = await SiteReportFactory.create({
        title: "second project report",
        status: "started",
        updateRequestStatus: "awaiting-approval",
        frameworkKey: "ppc",
        siteId: s1.id
      });
      const third = await SiteReportFactory.create({
        title: "third project report",
        status: "approved",
        updateRequestStatus: "awaiting-approval",
        frameworkKey: "ppc",
        siteId: s1.id
      });
      const fourth = await SiteReportFactory.create({
        title: "fourth project report",
        status: "approved",
        updateRequestStatus: "approved",
        frameworkKey: "terrafund",
        siteId: s2.id
      });

      first.site = await first.$get("site");
      second.site = await second.$get("site");
      third.site = await third.$get("site");
      fourth.site = await fourth.$get("site");

      await expectSiteReports([first, second, third], { updateRequestStatus: "awaiting-approval" });

      await expectSiteReports([first, third, fourth], { status: "approved" });

      await expectSiteReports([fourth], { projectUuid: p2.uuid });

      await expectSiteReports([first, second, third], { country: "MX" });

      await expectSiteReports([first, second, third], { siteUuid: s1.uuid });
    });

    it("should throw an error if the site uuid is not found", async () => {
      await expect(processor.findMany({ siteUuid: "123" })).rejects.toThrow(BadRequestException);
    });

    it("should filter site reports by taskId", async () => {
      const project = await ProjectFactory.create();
      const site = await SiteFactory.create({ projectId: project.id });
      const task1 = await TaskFactory.create({ projectId: project.id });
      const task2 = await TaskFactory.create({ projectId: project.id });
      await ProjectUserFactory.create({ userId: policyService().userId, projectId: project.id });

      const task1Reports = await SiteReportFactory.createMany(2, { siteId: site.id, taskId: task1.id });
      await SiteReportFactory.createMany(3, { siteId: site.id, taskId: task2.id });

      for (const report of task1Reports) {
        report.site = await report.$get("site");
      }

      await expectSiteReports(task1Reports, { taskId: task1.id }, { permissions: ["manage-own"] });
    });

    it("should sort site reports by project name", async () => {
      const projectA = await ProjectFactory.create({ name: "A Project" });
      const projectB = await ProjectFactory.create({ name: "B Project" });
      const projectC = await ProjectFactory.create({ name: "C Project" });
      const siteA = await SiteFactory.create({ projectId: projectA.id });
      const siteB = await SiteFactory.create({ projectId: projectB.id });
      const siteC = await SiteFactory.create({ projectId: projectC.id });
      const siteReportA = await SiteReportFactory.create({ siteId: siteA.id });
      const siteReportB = await SiteReportFactory.create({ siteId: siteB.id });
      const siteReportC = await SiteReportFactory.create({ siteId: siteC.id });
      await expectSiteReports(
        [siteReportA, siteReportB, siteReportC],
        { sort: { field: "projectName" } },
        { sortField: "projectName" }
      );
      await expectSiteReports(
        [siteReportC, siteReportB, siteReportA],
        { sort: { field: "projectName", direction: "DESC" } },
        { sortField: "projectName" }
      );
    });

    it("should sort site reports by organisation name", async () => {
      const org1 = await OrganisationFactory.create({ name: "A Org" });
      const org2 = await OrganisationFactory.create({ name: "B Org" });
      const org3 = await OrganisationFactory.create({ name: "C Org" });
      const projectA = await ProjectFactory.create({ organisationId: org1.id });
      const projectB = await ProjectFactory.create({ organisationId: org2.id });
      const projectC = await ProjectFactory.create({ organisationId: org3.id });
      const siteA = await SiteFactory.create({ projectId: projectA.id });
      const siteB = await SiteFactory.create({ projectId: projectB.id });
      const siteC = await SiteFactory.create({ projectId: projectC.id });
      projectA.organisation = await projectA.$get("organisation");
      projectB.organisation = await projectB.$get("organisation");
      projectC.organisation = await projectC.$get("organisation");

      const siteReports = [
        await SiteReportFactory.create({
          siteId: siteA.id
        })
      ];
      siteReports.push(
        await SiteReportFactory.create({
          siteId: siteB.id
        })
      );
      siteReports.push(
        await SiteReportFactory.create({
          siteId: siteC.id
        })
      );
      for (const s of siteReports) {
        s.site = await s.$get("site");
      }

      await expectSiteReports(siteReports, { sort: { field: "organisationName" } }, { sortField: "organisationName" });
      await expectSiteReports(
        siteReports,
        { sort: { field: "organisationName", direction: "DESC" } },
        { sortField: "organisationName", sortUp: false }
      );
    });

    it("should sort site reports by due date", async () => {
      const siteReportA = await SiteReportFactory.create({ dueAt: DateTime.now().minus({ days: 1 }).toJSDate() });
      const siteReportB = await SiteReportFactory.create({
        dueAt: DateTime.now().minus({ days: 10 }).toJSDate()
      });
      const siteReportC = await SiteReportFactory.create({ dueAt: DateTime.now().minus({ days: 5 }).toJSDate() });
      await expectSiteReports(
        [siteReportA, siteReportC, siteReportB],
        { sort: { field: "dueAt", direction: "DESC" } },
        { sortField: "dueAt", sortUp: false }
      );
      await expectSiteReports(
        [siteReportB, siteReportC, siteReportA],
        { sort: { field: "dueAt", direction: "ASC" } },
        { sortField: "dueAt", sortUp: true }
      );
    });

    it("should sort site reports by submitted at", async () => {
      const now = DateTime.now();
      const siteReportA = await SiteReportFactory.create({
        submittedAt: now.minus({ minutes: 1 }).toJSDate()
      });
      const siteReportB = await SiteReportFactory.create({
        submittedAt: now.minus({ minutes: 10 }).toJSDate()
      });
      const siteReportC = await SiteReportFactory.create({
        submittedAt: now.minus({ minutes: 5 }).toJSDate()
      });
      await expectSiteReports(
        [siteReportA, siteReportC, siteReportB],
        { sort: { field: "submittedAt", direction: "DESC" } },
        { sortField: "submittedAt", sortUp: false }
      );
      await expectSiteReports(
        [siteReportB, siteReportC, siteReportA],
        { sort: { field: "submittedAt", direction: "ASC" } },
        { sortField: "submittedAt", sortUp: true }
      );
    });

    it("should sort site reports by updated at", async () => {
      const siteReportA = await SiteReportFactory.create();
      siteReportA.updatedAt = DateTime.now().minus({ days: 1 }).toJSDate();

      await expectSiteReports([siteReportA], { sort: { field: "updatedAt" } }, { sortField: "updatedAt" });
      await expectSiteReports(
        [siteReportA],
        { sort: { field: "updatedAt", direction: "DESC" } },
        { sortField: "updatedAt", sortUp: false }
      );
    });

    it("should sort site reports by update request status", async () => {
      const siteReportA = await SiteReportFactory.create({ updateRequestStatus: "awaiting-approval" });
      const siteReportB = await SiteReportFactory.create({ updateRequestStatus: "awaiting-approval" });
      const siteReportC = await SiteReportFactory.create({ updateRequestStatus: "awaiting-approval" });
      await expectSiteReports(
        [siteReportA, siteReportB, siteReportC],
        { sort: { field: "updateRequestStatus" } },
        { sortField: "updateRequestStatus" }
      );
      await expectSiteReports(
        [siteReportA, siteReportB, siteReportC],
        { sort: { field: "updateRequestStatus", direction: "ASC" } },
        { sortField: "updateRequestStatus" }
      );
      await expectSiteReports(
        [siteReportC, siteReportB, siteReportA],
        { sort: { field: "updateRequestStatus", direction: "DESC" } },
        { sortField: "updateRequestStatus", sortUp: false }
      );
    });

    it("should sort site reports by status", async () => {
      const siteReportA = await SiteReportFactory.create({ status: "started" });
      const siteReportB = await SiteReportFactory.create({ status: "approved" });
      const siteReportC = await SiteReportFactory.create({ status: "approved" });
      await expectSiteReports(
        [siteReportA, siteReportB, siteReportC],
        { sort: { field: "status" } },
        { sortField: "status" }
      );
      await expectSiteReports(
        [siteReportA, siteReportB, siteReportC],
        { sort: { field: "status", direction: "ASC" } },
        { sortField: "status" }
      );
      await expectSiteReports(
        [siteReportC, siteReportB, siteReportA],
        { sort: { field: "status", direction: "DESC" } },
        { sortField: "status", sortUp: false }
      );
    });

    it("should throw an error if the sort field is not valid", async () => {
      await expect(processor.findMany({ sort: { field: "invalid" } })).rejects.toThrow(BadRequestException);
    });

    it("should paginate site reports", async () => {
      const siteReports = sortBy(await SiteReportFactory.createMany(25), "id");
      await expectSiteReports(siteReports.slice(0, 10), { page: { size: 10 } }, { total: siteReports.length });
      await expectSiteReports(
        siteReports.slice(10, 20),
        { page: { size: 10, number: 2 } },
        { total: siteReports.length }
      );
      await expectSiteReports(siteReports.slice(20), { page: { size: 10, number: 3 } }, { total: siteReports.length });
    });
  });

  describe("findOne", () => {
    it("should return a requested site report", async () => {
      const siteReport = await SiteReportFactory.create();
      const result = await processor.findOne(siteReport.uuid);
      expect(result?.id).toBe(siteReport.id);
    });
  });

  describe("getFullDto / getLightDto", () => {
    it("should serialize a Site Report as a light resource (SiteReportLightDto)", async () => {
      const { uuid } = await SiteReportFactory.create();
      const siteReport = await processor.findOne(uuid);
      const { id, dto } = await processor.getLightDto(siteReport!);
      expect(id).toEqual(uuid);
      expect(dto).toMatchObject({
        uuid,
        lightResource: true
      });
    });

    it("should include calculated fields in SiteReportFullDto completion Completed", async () => {
      const project = await ProjectFactory.create();
      const site = await SiteFactory.create({ projectId: project.id });

      const { uuid } = await SiteReportFactory.create({
        siteId: site.id,
        title: "Site Report",
        completion: 100
      });

      const siteReport = await processor.findOne(uuid);
      const { id, dto } = await processor.getFullDto(siteReport!);
      expect(id).toEqual(uuid);
      expect(dto).toMatchObject({
        uuid,
        lightResource: false,
        projectUuid: project.uuid,
        siteUuid: site.uuid
      });
    });

    it("should include calculated fields in SiteReportFullDto completion Not Completed", async () => {
      const project = await ProjectFactory.create();
      const site = await SiteFactory.create({ projectId: project.id });

      const { taskId } = await ProjectReportFactory.create({ projectId: project.id });
      const { uuid } = await SiteReportFactory.create({
        siteId: site.id,
        taskId: taskId!,
        title: null,
        dueAt: null,
        completion: 0
      });

      const siteReport = await processor.findOne(uuid);
      const { id, dto } = await processor.getFullDto(siteReport!);
      expect(id).toEqual(uuid);
      expect(dto).toMatchObject({
        uuid,
        lightResource: false,
        projectUuid: project.uuid,
        siteUuid: site.uuid
      });
    });

    it("should handle a missing taskId", async () => {
      const project = await ProjectFactory.create();
      const site = await SiteFactory.create({ projectId: project.id });

      const { uuid } = await SiteReportFactory.create({
        siteId: site.id,
        taskId: undefined,
        title: undefined,
        dueAt: undefined,
        completion: 0
      });

      const siteReport = await processor.findOne(uuid);
      const { id, dto } = await processor.getFullDto(siteReport!);
      expect(id).toEqual(uuid);
      expect(dto).toMatchObject({
        uuid,
        lightResource: false,
        projectUuid: project.uuid,
        siteUuid: site.uuid
      });
    });

    it("should include calculated fields in SiteReportFullDto completion Started", async () => {
      const project = await ProjectFactory.create();
      const site = await SiteFactory.create({ projectId: project.id });

      const { uuid } = await SiteReportFactory.create({
        siteId: site.id,
        title: "",
        dueAt: null,
        completion: 50
      });

      const siteReport = await processor.findOne(uuid);
      const { id, dto } = await processor.getFullDto(siteReport!);
      expect(id).toEqual(uuid);
      expect(dto).toMatchObject({
        uuid,
        lightResource: false,
        projectUuid: project.uuid,
        siteUuid: site.uuid
      });
    });
  });

  describe("processSideload", () => {
    it("should include sideloaded tree species", async () => {
      const siteReport = await SiteReportFactory.create();
      await TreeSpeciesFactory.siteReportTreePlanted(siteReport).createMany(3);

      setMockedPermissions("projects-read");
      const document = buildJsonApi(SiteReportLightDto);
      await processor.addIndex(document, {
        sideloads: [{ entity: "treeSpecies", pageSize: 5 }]
      });

      const result = document.serialize();
      expect(result.included?.length).toBe(3);
      expect(result.included!.filter(({ type }) => type === "treeSpecies").length).toBe(3);
    });

    it("should throw an error for unsupported sideload entities", async () => {
      const siteReport = await SiteReportFactory.create();

      const document = buildJsonApi(SiteReportLightDto);
      await expect(processor.processSideload(document, siteReport, "sites")).rejects.toThrow(BadRequestException);
    });
  });

  describe("getReportTitleBase", () => {
    beforeEach(() => {
      jest.spyOn(processor["entitiesService"], "userLocale", "get").mockReturnValue("en-US");
      processor["entitiesService"].localizeText = jest.fn(async str => str);
    });

    it("should use the first branch for dueAt <= cutoffOneMonth and framework ppc", async () => {
      const dueAt = new Date("2023-04-01T00:00:00.000Z");
      await processor["getReportTitleBase"](dueAt, "Test Title", "ppc");
      expect(processor["entitiesService"].localizeText).toHaveBeenCalledWith(
        "{title} for {month} {year}",
        expect.objectContaining({ title: "Test Title" })
      );
    });

    it("should use the second branch for dueAt >= cutoffThreeMonths and framework ppc", async () => {
      const dueAt = new Date("2023-07-15T00:00:00.000Z");
      await processor["getReportTitleBase"](dueAt, "Test Title", "ppc");
      expect(processor["entitiesService"].localizeText).toHaveBeenCalledWith(
        "{title} for {startMonth}-{endMonth} {year}",
        expect.objectContaining({ title: "Test Title" })
      );
    });

    it("should use the else branch for dueAt between cutoffs and framework ppc", async () => {
      const dueAt = new Date("2023-05-15T00:00:00.000Z");
      await processor["getReportTitleBase"](dueAt, "Test Title", "ppc");
      expect(processor["entitiesService"].localizeText).toHaveBeenCalledWith(
        "{title} for {startDate} - {endDate}",
        expect.objectContaining({ title: "Test Title" })
      );
    });

    it("should use the else external branch for non-ppc framework", async () => {
      const dueAt = new Date("2023-05-15T00:00:00.000Z");
      await processor["getReportTitleBase"](dueAt, "Test Title", "terrafund");
      expect(processor["entitiesService"].localizeText).toHaveBeenCalledWith(
        "{title} for {startDate} - {endDate}",
        expect.objectContaining({ title: "Test Title" })
      );
    });
  });

  describe("export", () => {
    it("throws if the report is not found", async () => {
      await expect(processor.export("fake-uuid", {} as Response)).rejects.toThrow(NotFoundException);
    });

    it("throws if the report is missing a framework key", async () => {
      const report = await SiteReportFactory.create({ frameworkKey: null });
      await expect(processor.export(report.uuid, {} as Response)).rejects.toThrow(InternalServerErrorException);
    });

    it("calls entity export", async () => {
      const report = await SiteReportFactory.create({ frameworkKey: "ppc" });
      const exportSpy = jest.spyOn(entitiesService(), "entityExport").mockResolvedValue();
      await processor.export(report.uuid, {} as Response);
      expect(exportSpy).toHaveBeenCalledWith(
        "siteReports",
        expect.anything(),
        [expect.objectContaining({ uuid: report.uuid })],
        expect.anything()
      );
    });
  });

  describe("exportAll", () => {
    it("throws if the framework key is missing", async () => {
      await expect(processor.exportAll({})).rejects.toThrow("Framework key not found");
    });

    it("writes all site reports to the CSV", async () => {
      setMockedPermissions("framework-ppc");
      await SiteReport.truncate();
      const orgs = [
        await OrganisationFactory.create({ type: "non-profit-organization" }),
        await OrganisationFactory.create({ type: "for-profit-organization" })
      ];
      const projects = [
        await ProjectFactory.create({ organisationId: orgs[0].id, frameworkKey: "ppc" }),
        await ProjectFactory.create({ organisationId: orgs[1].id, frameworkKey: "ppc" })
      ];
      const sites = [
        await SiteFactory.create({ projectId: projects[0].id, frameworkKey: "ppc" }),
        await SiteFactory.create({ projectId: projects[1].id, frameworkKey: "ppc" })
      ];
      const reports = [
        await SiteReportFactory.create({ siteId: sites[0].id, frameworkKey: "ppc" }),
        await SiteReportFactory.create({ siteId: sites[1].id, frameworkKey: "ppc" }),
        await SiteReportFactory.create({ siteId: sites[1].id, frameworkKey: "ppc" })
      ];
      // non framework reports should be ignored
      await SiteReportFactory.create({ frameworkKey: "terrafund" });
      await EntityFormFactory.siteReport(reports[0]).create();

      const firstTreeSum = sum(
        (await TreeSpeciesFactory.siteReportTreePlanted(reports[1]).createMany(2)).map(({ amount }) => amount)
      );
      const secondTreeSum = sum(
        (await TreeSpeciesFactory.siteReportTreePlanted(reports[2]).createMany(3)).map(({ amount }) => amount)
      );
      const firstSeedSum = sum((await SeedingFactory.siteReport(reports[1]).createMany(2)).map(({ amount }) => amount));
      const secondSeedSum = sum(
        (await SeedingFactory.siteReport(reports[2]).createMany(3)).map(({ amount }) => amount)
      );

      const addRow = jest.fn();
      csvExportService().writeCsv.mockImplementation(async (fileName, response, columns, writeRows) => {
        await writeRows(addRow);
      });
      await processor.exportAll({ frameworkKey: "ppc" });

      expect(addRow).toHaveBeenCalledTimes(3);
      const [result1, additional1] = addRow.mock.calls[0] as [SiteReport, Dictionary<unknown>];
      expect(result1).toMatchObject({ uuid: reports[0].uuid });
      expect(result1.projectName).toEqual(projects[0].name);
      expect(result1.organisationReadableType).toEqual("Non Profit Organization");
      expect(result1.organisationName).toEqual(orgs[0].name);
      expect(additional1).toMatchObject({
        totalTreesPlanted: null,
        totalTreesPlantedReport: null,
        totalSeedsPlanted: null,
        totalSeedsPlantedReport: null
      });
      const [result2, additional2] = addRow.mock.calls[1] as [SiteReport, Dictionary<unknown>];
      expect(result2).toMatchObject({ uuid: reports[1].uuid });
      expect(result2.projectName).toEqual(projects[1].name);
      expect(result2.organisationReadableType).toEqual("For Profit Organization");
      expect(result2.organisationName).toEqual(orgs[1].name);
      expect(additional2).toMatchObject({
        totalTreesPlanted: firstTreeSum + secondTreeSum,
        totalTreesPlantedReport: firstTreeSum,
        totalSeedsPlanted: firstSeedSum + secondSeedSum,
        totalSeedsPlantedReport: firstSeedSum
      });
      const [result3, additional3] = addRow.mock.calls[2] as [SiteReport, Dictionary<unknown>];
      expect(result3).toMatchObject({ uuid: reports[2].uuid });
      expect(result3.projectName).toEqual(projects[1].name);
      expect(result3.organisationReadableType).toEqual("For Profit Organization");
      expect(result3.organisationName).toEqual(orgs[1].name);
      expect(additional3).toMatchObject({
        totalTreesPlanted: firstTreeSum + secondTreeSum,
        totalTreesPlantedReport: secondTreeSum,
        totalSeedsPlanted: firstSeedSum + secondSeedSum,
        totalSeedsPlantedReport: secondSeedSum
      });
    });

    it("writes project site reports to the CSV", async () => {
      await SiteReport.truncate();
      const org = await OrganisationFactory.create({ type: "non-profit-organization" });
      const projects = [
        await ProjectFactory.create({ organisationId: org.id, frameworkKey: "ppc" }),
        await ProjectFactory.create({ organisationId: org.id, frameworkKey: "ppc" })
      ];
      const sites = [
        await SiteFactory.create({ projectId: projects[0].id, frameworkKey: "ppc" }),
        await SiteFactory.create({ projectId: projects[1].id, frameworkKey: "ppc" })
      ];
      const reports = [
        await SiteReportFactory.create({ siteId: sites[0].id, frameworkKey: "ppc" }),
        await SiteReportFactory.create({ siteId: sites[1].id, frameworkKey: "ppc" }),
        await SiteReportFactory.create({ siteId: sites[1].id, frameworkKey: "ppc" })
      ];
      await EntityFormFactory.siteReport(reports[0]).create();

      const firstTreeSum = sum(
        (await TreeSpeciesFactory.siteReportTreePlanted(reports[1]).createMany(2)).map(({ amount }) => amount)
      );
      const secondTreeSum = sum(
        (await TreeSpeciesFactory.siteReportTreePlanted(reports[2]).createMany(3)).map(({ amount }) => amount)
      );
      const firstSeedSum = sum((await SeedingFactory.siteReport(reports[1]).createMany(2)).map(({ amount }) => amount));
      const secondSeedSum = sum(
        (await SeedingFactory.siteReport(reports[2]).createMany(3)).map(({ amount }) => amount)
      );

      const addRow = jest.fn();
      csvExportService().writeCsv.mockImplementation(async (fileName, response, columns, writeRows) => {
        await writeRows(addRow);
      });
      await processor.exportAll({ projectUuid: projects[1].uuid });

      expect(addRow).toHaveBeenCalledTimes(2);
      const [result1, additional1] = addRow.mock.calls[0] as [SiteReport, Dictionary<unknown>];
      expect(result1).toMatchObject({ uuid: reports[1].uuid });
      expect(result1.projectName).toEqual(projects[1].name);
      expect(result1.organisationReadableType).toEqual("Non Profit Organization");
      expect(result1.organisationName).toEqual(org.name);
      expect(additional1).toMatchObject({
        totalTreesPlanted: firstTreeSum + secondTreeSum,
        totalTreesPlantedReport: firstTreeSum,
        totalSeedsPlanted: firstSeedSum + secondSeedSum,
        totalSeedsPlantedReport: firstSeedSum
      });
      const [result2, additional2] = addRow.mock.calls[1] as [SiteReport, Dictionary<unknown>];
      expect(result2).toMatchObject({ uuid: reports[2].uuid });
      expect(result2.projectName).toEqual(projects[1].name);
      expect(result2.organisationReadableType).toEqual("Non Profit Organization");
      expect(result2.organisationName).toEqual(org.name);
      expect(additional2).toMatchObject({
        totalTreesPlanted: firstTreeSum + secondTreeSum,
        totalTreesPlantedReport: secondTreeSum,
        totalSeedsPlanted: firstSeedSum + secondSeedSum,
        totalSeedsPlantedReport: secondSeedSum
      });
    });
  });
});

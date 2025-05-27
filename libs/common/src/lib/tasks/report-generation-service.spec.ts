/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { NurseryFactory, ProjectFactory, SiteFactory, TaskFactory } from "@terramatch-microservices/database/factories";
import { ReportGenerationService } from "./report-generation-service";
import { Test } from "@nestjs/testing";
import { Action, Task } from "@terramatch-microservices/database/entities";
import { NotFoundException } from "@nestjs/common";
import { DateTime } from "luxon";
import { uniq } from "lodash";

describe("ReportGenerationService", () => {
  let service: ReportGenerationService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [ReportGenerationService]
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
      const { id: projectId } = await ProjectFactory.create();
      const dueAt = DateTime.now().set({ millisecond: 0 }).toJSDate();
      await service.createTask(projectId, dueAt);
      const task = await Task.findOne({ where: { projectId } });
      expect(task).toBeDefined();
      const projectReport = await task!.$get("projectReport");
      expect(projectReport?.projectId).toBe(projectId);
      expect(projectReport?.dueAt).toEqual(dueAt);
      expect(projectReport?.status).toBe("due");
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
  });
});

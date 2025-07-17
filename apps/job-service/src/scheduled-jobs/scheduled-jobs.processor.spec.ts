/* eslint-disable @typescript-eslint/no-explicit-any */
import { Test } from "@nestjs/testing";
import { createMock, DeepMocked } from "@golevelup/ts-jest";
import {
  REPORT_REMINDER_EVENT,
  ScheduledJobsProcessor,
  SITE_AND_NURSERY_REMINDER_EVENT,
  TASK_DUE_EVENT
} from "./scheduled-jobs.processor";
import { getQueueToken } from "@nestjs/bullmq";
import { Job, Queue } from "bullmq";
import { ReportGenerationService } from "@terramatch-microservices/common/tasks/report-generation-service";
import { ScheduledJobFactory } from "@terramatch-microservices/database/factories/scheduled-job.factory";
import { Project } from "@terramatch-microservices/database/entities";
import { NurseryFactory, ProjectFactory, SiteFactory } from "@terramatch-microservices/database/factories";
import { DateTime } from "luxon";

describe("ScheduledJobsProcessor", () => {
  let processor: ScheduledJobsProcessor;
  let queue: DeepMocked<Queue>;
  let reportGenerationService: DeepMocked<ReportGenerationService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        ScheduledJobsProcessor,
        { provide: getQueueToken("email"), useValue: (queue = createMock<Queue>()) },
        {
          provide: ReportGenerationService,
          useValue: (reportGenerationService = createMock<ReportGenerationService>())
        }
      ]
    }).compile();

    processor = await module.resolve(ScheduledJobsProcessor);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("process", () => {
    it("should restore the job if processing it fails", async () => {
      jest.spyOn(processor as any, "processTaskDue").mockRejectedValue(new Error("Failed"));
      const job = await ScheduledJobFactory.forTaskDue.create();
      await job.destroy();
      await processor.process({ name: TASK_DUE_EVENT, data: job } as Job);
      await job.reload();
      expect(job.deletedAt).toBeNull();
    });

    it("should log an error if the job type is not recognized", async () => {
      const logSpy = jest.spyOn((processor as any).logger, "error");
      await processor.process({ name: "fake", data: { taskDefinition: {} } } as Job);
      expect(logSpy).toHaveBeenCalledWith(`Unrecognized job type: fake`, expect.anything());
    });
  });

  describe("processTaskDue", () => {
    it("should call the service with all projects in the framework", async () => {
      await Project.truncate();
      const projects = await ProjectFactory.createMany(150, { frameworkKey: "ppc", status: "approved" });
      await ProjectFactory.create({ frameworkKey: "terrafund", status: "approved" });
      await ProjectFactory.create({ frameworkKey: "hbf", status: "approved" });
      const dueAt = DateTime.now().plus({ months: 1 }).set({ millisecond: 0 }).toISO();
      await processor.process({
        name: TASK_DUE_EVENT,
        data: { taskDefinition: { frameworkKey: "ppc", dueAt } }
      } as Job);
      expect(reportGenerationService.createTask).toHaveBeenCalledTimes(projects.length);
    });

    it("should log an error if the service fails", async () => {
      await Project.truncate();
      reportGenerationService.createTask.mockRejectedValue(new Error("Failed"));
      await ProjectFactory.create({ frameworkKey: "terrafund", status: "approved" });
      const dueAt = DateTime.now().plus({ months: 1 }).set({ millisecond: 0 }).toISO();
      const logSpy = jest.spyOn((processor as any).logger, "error");
      await processor.process({
        name: TASK_DUE_EVENT,
        data: { taskDefinition: { frameworkKey: "terrafund", dueAt } }
      } as Job);
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("Failed to create task for some projects:"));
    });
  });

  describe("processReportReminder", () => {
    it("should log a warning and quit if the framework is not terrafund", async () => {
      const logSpy = jest.spyOn((processor as any).logger, "warn");
      const projectSpy = jest.spyOn(Project, "findAll");
      await processor.process({
        name: REPORT_REMINDER_EVENT,
        data: { taskDefinition: { frameworkKey: "ppc" } }
      } as Job);
      expect(logSpy).toHaveBeenCalledWith("Report reminder for framework other than terrafund: ppc, ignoring");
      expect(projectSpy).not.toHaveBeenCalled();
    });

    it("should add to the email queue with all appropriate project ids", async () => {
      const projects = await ProjectFactory.createMany(3, { frameworkKey: "terrafund", status: "approved" });
      for (const project of projects) {
        await SiteFactory.create({ projectId: project.id });
        await NurseryFactory.create({ projectId: project.id });
      }
      await ProjectFactory.create({ frameworkKey: "terrafund", status: "approved" });
      await processor.process({
        name: REPORT_REMINDER_EVENT,
        data: { taskDefinition: { frameworkKey: "terrafund" } }
      } as Job);

      expect(queue.add).toHaveBeenCalledWith(
        "terrafundReportReminder",
        expect.objectContaining({
          projectIds: expect.arrayContaining(projects.map(({ id }) => id))
        })
      );
    });
  });

  describe("processSiteAndNurseryReminder", () => {
    it("should log a warning and quit if the framework is not terrafund", async () => {
      const logSpy = jest.spyOn((processor as any).logger, "warn");
      const projectSpy = jest.spyOn(Project, "findAll");
      await processor.process({
        name: SITE_AND_NURSERY_REMINDER_EVENT,
        data: { taskDefinition: { frameworkKey: "ppc" } }
      } as Job);
      expect(logSpy).toHaveBeenCalledWith(
        "Site and Nursery reminder for framework other than terrafund: ppc, ignoring"
      );
      expect(projectSpy).not.toHaveBeenCalled();
    });

    it("should add to the email queue with all appropriate project ids", async () => {
      const projects = await ProjectFactory.createMany(3, { frameworkKey: "terrafund", status: "approved" });
      const siteProject = await ProjectFactory.create({ frameworkKey: "terrafund", status: "approved" });
      await SiteFactory.create({ projectId: siteProject.id });
      const nurseryProject = await ProjectFactory.create({ frameworkKey: "terrafund", status: "approved" });
      await NurseryFactory.create({ projectId: nurseryProject.id });
      await processor.process({
        name: SITE_AND_NURSERY_REMINDER_EVENT,
        data: { taskDefinition: { frameworkKey: "terrafund" } }
      } as Job);

      expect(queue.add).toHaveBeenCalledWith(
        "terrafundSiteAndNurseryReminder",
        expect.objectContaining({
          projectIds: expect.arrayContaining(projects.map(({ id }) => id))
        })
      );
    });
  });
});

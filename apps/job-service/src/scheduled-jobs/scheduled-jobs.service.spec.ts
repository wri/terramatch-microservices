/* eslint-disable @typescript-eslint/no-explicit-any */
import { faker } from "@faker-js/faker";
import { createMock, DeepMocked } from "@golevelup/ts-jest";
import { Queue } from "bullmq";
import { Test } from "@nestjs/testing";
import { getQueueToken } from "@nestjs/bullmq";
import { ScheduledJobsService } from "./scheduled-jobs.service";
import { ScheduledJob } from "@terramatch-microservices/database/entities";
import { ScheduledJobFactory } from "@terramatch-microservices/database/factories/scheduled-job.factory";
import { REPORT_REMINDER_EVENT, SITE_AND_NURSERY_REMINDER_EVENT, TASK_DUE_EVENT } from "./scheduled-jobs.processor";

describe("ScheduledJobsService", () => {
  let service: ScheduledJobsService;
  let queue: DeepMocked<Queue>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        ScheduledJobsService,
        { provide: getQueueToken("scheduled-jobs"), useValue: (queue = createMock<Queue>()) }
      ]
    }).compile();

    service = module.get(ScheduledJobsService);

    await ScheduledJob.truncate();
  });

  describe("processScheduledJobs", () => {
    it("should noop with no jobs", async () => {
      const processSpy = jest.spyOn(service as any, "processJob");
      await service.processScheduledJobs();
      expect(processSpy).not.toHaveBeenCalled();
    });

    it("should ignore jobs that aren't scheduled yet", async () => {
      const processSpy = jest.spyOn(service as any, "processJob");
      const job = await ScheduledJobFactory.forReportReminder.create({ executionTime: faker.date.future() });
      expect(processSpy).not.toHaveBeenCalled();
      await job.reload();
      expect(job.deletedAt).toBeNull();
    });

    it("should log an error if the job type is not recognized", async () => {
      const logSpy = jest.spyOn((service as any).logger, "error");
      const job = await ScheduledJobFactory.forReportReminder.create({
        executionTime: faker.date.recent(),
        // @ts-expect-error bad job type for testing
        type: "fake"
      });
      await service.processScheduledJobs();
      expect(logSpy).toHaveBeenCalledWith(
        `Unrecognized job type: ${job.type}`,
        expect.objectContaining({ id: job.id })
      );
    });

    it("should add to the queue for ready jobs", async () => {
      const reportReminder = await ScheduledJobFactory.forReportReminder.create();
      const siteAndNurseryReminder = await ScheduledJobFactory.forSiteAndNurseryReminder.create();
      const taskDue = await ScheduledJobFactory.forTaskDue.create();
      await service.processScheduledJobs();
      expect(queue.add).toHaveBeenCalledWith(
        TASK_DUE_EVENT,
        expect.objectContaining({ id: taskDue.id, taskDefinition: expect.objectContaining(taskDue.taskDefinition) })
      );
      expect(queue.add).toHaveBeenCalledWith(
        REPORT_REMINDER_EVENT,
        expect.objectContaining({
          id: reportReminder.id,
          taskDefinition: expect.objectContaining(reportReminder.taskDefinition)
        })
      );
      expect(queue.add).toHaveBeenCalledWith(
        SITE_AND_NURSERY_REMINDER_EVENT,
        expect.objectContaining({
          id: siteAndNurseryReminder.id,
          taskDefinition: expect.objectContaining(siteAndNurseryReminder.taskDefinition)
        })
      );
    });
  });
});

/* eslint-disable @typescript-eslint/no-explicit-any */
import { faker } from "@faker-js/faker";
import { createMock, DeepMocked } from "@golevelup/ts-jest";
import { Queue } from "bullmq";
import { Test } from "@nestjs/testing";
import { getQueueToken } from "@nestjs/bullmq";
import { Transaction } from "sequelize";
import { ScheduledJobsService } from "./scheduled-jobs.service";
import { ScheduledJob, Task } from "@terramatch-microservices/database/entities";
import { ScheduledJobFactory } from "@terramatch-microservices/database/factories/scheduled-job.factory";
import { REPORT_REMINDER_EVENT, SITE_AND_NURSERY_REMINDER_EVENT, TASK_DUE_EVENT } from "./scheduled-jobs.processor";
import { TaskDigestEmail } from "@terramatch-microservices/common/email/terrafund-report-reminder.email";
import { WeeklyPolygonUpdateEmail } from "@terramatch-microservices/common/email/weekly-polygon-update.email";

describe("ScheduledJobsService", () => {
  let service: ScheduledJobsService;
  let queue: DeepMocked<Queue>;
  let emailQueue: DeepMocked<Queue>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        ScheduledJobsService,
        { provide: getQueueToken("scheduled-jobs"), useValue: (queue = createMock<Queue>()) },
        { provide: getQueueToken("email"), useValue: (emailQueue = createMock<Queue>()) }
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

  describe("ensureAnnualTaskDueJobs", () => {
    it("should schedule TaskDue jobs for future years when none exist", async () => {
      const scheduleSpy = jest.spyOn(ScheduledJob, "scheduleTaskDue").mockResolvedValue(undefined);
      const taskDueSpy = jest.spyOn(ScheduledJob, "taskDue").mockReturnValue({
        // simulate no existing jobs
        findAll: jest.fn().mockResolvedValue([])
      } as unknown as typeof ScheduledJob);

      await service.ensureAnnualTaskDueJobs();

      expect(scheduleSpy).toHaveBeenCalled();
      scheduleSpy.mockRestore();
      taskDueSpy.mockRestore();
    });

    it("should not create duplicate TaskDue when one already exists for same framework and dueAt", async () => {
      const dueAtISO = "2027-01-31T00:00:00.000Z";
      const scheduleSpy = jest.spyOn(ScheduledJob, "scheduleTaskDue").mockResolvedValue(undefined);
      const taskDueSpy = jest.spyOn(ScheduledJob, "taskDue").mockReturnValue({
        // simulate an existing TaskDue for enterprises 2027-01-31 so it should be skipped
        findAll: jest.fn().mockResolvedValue([{ taskDefinition: { frameworkKey: "enterprises", dueAt: dueAtISO } }])
      } as unknown as typeof ScheduledJob);

      await service.ensureAnnualTaskDueJobs();

      const enterprisesJan2027Calls = scheduleSpy.mock.calls.filter(
        ([, fw, due]) => fw === "enterprises" && due.toISOString().startsWith("2027-01-31")
      );
      expect(enterprisesJan2027Calls).toHaveLength(0);
      scheduleSpy.mockRestore();
      taskDueSpy.mockRestore();
    });
  });

  describe("enqueueTaskDigestEmails", () => {
    let transactionSpy: jest.SpyInstance;
    let querySpy: jest.SpyInstance;

    beforeEach(() => {
      const sequelize = Task.sequelize;
      if (sequelize == null) {
        throw new Error("Task.sequelize is not initialized");
      }
      const mockTransaction = async (arg?: unknown) => {
        if (typeof arg === "function") {
          return await (arg as (t: Transaction) => Promise<void>)({} as Transaction);
        }
        return {} as Transaction;
      };
      const mockQuery = async (sql: string | { query: string }) => {
        const q = typeof sql === "string" ? sql : sql.query;
        if (q.includes("GET_LOCK")) {
          return [{ got: 1 }];
        }
        if (q.includes("RELEASE_LOCK")) {
          return [{ rel: 1 }];
        }
        return [];
      };
      transactionSpy = jest.spyOn(sequelize, "transaction").mockImplementation(mockTransaction as never);
      querySpy = jest.spyOn(sequelize, "query").mockImplementation(mockQuery as never);
    });

    afterEach(() => {
      transactionSpy.mockRestore();
      querySpy.mockRestore();
    });

    it("should not enqueue when no incomplete tasks", async () => {
      const countSpy = jest.spyOn(Task, "count").mockResolvedValue(0);
      await service.enqueueTaskDigestEmails();
      expect(emailQueue.add).not.toHaveBeenCalled();
      countSpy.mockRestore();
    });

    it("should enqueue task digest jobs using paginated batches", async () => {
      const countSpy = jest.spyOn(Task, "count").mockResolvedValue(3);
      const findAllSpy = jest.spyOn(Task, "findAll").mockResolvedValue([{ id: 10 }, { id: 20 }, { id: 30 }] as Task[]);

      await service.enqueueTaskDigestEmails();

      expect(emailQueue.add).toHaveBeenCalledTimes(1);
      expect(emailQueue.add).toHaveBeenCalledWith(TaskDigestEmail.NAME, { taskIds: [10, 20, 30] });
      countSpy.mockRestore();
      findAllSpy.mockRestore();
    });
  });

  describe("enqueueWeeklyPolygonUpdateEmails", () => {
    let transactionSpy: jest.SpyInstance;
    let querySpy: jest.SpyInstance;

    beforeEach(() => {
      const sequelize = Task.sequelize;
      if (sequelize == null) {
        throw new Error("Task.sequelize is not initialized");
      }
      const mockTransaction = async (arg?: unknown) => {
        if (typeof arg === "function") {
          return await (arg as (t: Transaction) => Promise<void>)({} as Transaction);
        }
        return {} as Transaction;
      };
      const mockQuery = async (sql: string | { query: string }) => {
        const q = typeof sql === "string" ? sql : sql.query;
        if (q.includes("GET_LOCK")) {
          return [{ got: 1 }];
        }
        if (q.includes("RELEASE_LOCK")) {
          return [{ rel: 1 }];
        }
        return [];
      };
      transactionSpy = jest.spyOn(sequelize, "transaction").mockImplementation(mockTransaction as never);
      querySpy = jest.spyOn(sequelize, "query").mockImplementation(mockQuery as never);
    });

    afterEach(() => {
      transactionSpy.mockRestore();
      querySpy.mockRestore();
    });

    it("should not enqueue when no polygon UUIDs in window", async () => {
      const loadSpy = jest.spyOn(WeeklyPolygonUpdateEmail, "loadRecentSitePolygonUuids").mockResolvedValue([]);
      await service.enqueueWeeklyPolygonUpdateEmails();
      expect(emailQueue.add).not.toHaveBeenCalled();
      loadSpy.mockRestore();
    });

    it("should enqueue polygon digest jobs in uuid chunks", async () => {
      const uuids = ["uuid-a", "uuid-b"];
      const loadSpy = jest.spyOn(WeeklyPolygonUpdateEmail, "loadRecentSitePolygonUuids").mockResolvedValue(uuids);
      await service.enqueueWeeklyPolygonUpdateEmails();
      expect(emailQueue.add).toHaveBeenCalledWith(WeeklyPolygonUpdateEmail.NAME, { sitePolygonUuids: uuids });
      loadSpy.mockRestore();
    });

    it("should split polygon UUIDs into multiple queue jobs when above chunk size", async () => {
      const uuids = Array.from({ length: 51 }, (_, i) => `uuid-${i}`);
      const loadSpy = jest.spyOn(WeeklyPolygonUpdateEmail, "loadRecentSitePolygonUuids").mockResolvedValue(uuids);
      await service.enqueueWeeklyPolygonUpdateEmails();
      expect(emailQueue.add).toHaveBeenCalledTimes(2);
      expect(emailQueue.add).toHaveBeenNthCalledWith(1, WeeklyPolygonUpdateEmail.NAME, {
        sitePolygonUuids: uuids.slice(0, 50)
      });
      expect(emailQueue.add).toHaveBeenNthCalledWith(2, WeeklyPolygonUpdateEmail.NAME, {
        sitePolygonUuids: uuids.slice(50, 51)
      });
      loadSpy.mockRestore();
    });
  });
});

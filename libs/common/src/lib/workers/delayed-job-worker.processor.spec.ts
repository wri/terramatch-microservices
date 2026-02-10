/* eslint-disable @typescript-eslint/no-explicit-any */
import { Job } from "bullmq";
import {
  DelayedJobData,
  DelayedJobException,
  DelayedJobResult,
  DelayedJobWorker
} from "./delayed-job-worker.processor";
import { DelayedJobFactory, OrganisationFactory } from "@terramatch-microservices/database/factories";
import { FAILED, SUCCEEDED } from "@terramatch-microservices/database/constants/status";
import { buildJsonApi, JsonApiDocument } from "../util";
import { OrganisationLightDto } from "../dto";

class MockWorker extends DelayedJobWorker<DelayedJobData> {
  constructor(public readonly processResponse: Error | DelayedJobResult) {
    super();
  }

  async processDelayedJob() {
    if (this.processResponse instanceof Error) throw this.processResponse;
    return this.processResponse;
  }
}

describe("DelayedJobWorker", () => {
  describe("process", () => {
    it("logs an error if the delayed job is not found", async () => {
      const processor = new MockWorker(new Error("unused"));
      const logSpy = jest.spyOn((processor as any).logger, "error");
      const processSpy = jest.spyOn(processor, "processDelayedJob");
      await processor.process({ data: { delayedJobId: -1 } } as Job<DelayedJobData>);
      expect(logSpy).toHaveBeenCalledWith("Delayed job not found! -1");
      expect(processSpy).not.toHaveBeenCalled();
    });

    it("Fails the delayed job if there is an error", async () => {
      const processor = new MockWorker(new DelayedJobException(400, "Test message"));
      const job = await DelayedJobFactory.pending.create();
      await processor.process({ data: { delayedJobId: job.id } } as Job<DelayedJobData>);
      await job.reload();
      expect(job.status).toBe(FAILED);
      expect(job.statusCode).toBe(400);
      expect((job.payload as { message: string }).message).toBe("Test message");
    });

    it("Fails the delayed job if there is an unexpected error", async () => {
      const processor = new MockWorker(new Error("Something unexpected"));
      const job = await DelayedJobFactory.pending.create();
      await processor.process({ data: { delayedJobId: job.id } } as Job<DelayedJobData>);
      await job.reload();
      expect(job.status).toBe(FAILED);
      expect(job.statusCode).toBe(500);
      expect((job.payload as { message: string }).message).toBe("Something unexpected");
    });

    it("Succeeds the delayed job if there is a payload returned", async () => {
      const org = await OrganisationFactory.create();
      const document = buildJsonApi(OrganisationLightDto).addData(org.uuid, new OrganisationLightDto(org));
      const processor = new MockWorker({ payload: document });
      const job = await DelayedJobFactory.pending.create();
      await processor.process({ data: { delayedJobId: job.id } } as Job<DelayedJobData>);
      await job.reload();
      expect(job.status).toBe(SUCCEEDED);
      expect(job.statusCode).toBe(200);
      expect(job.payload as JsonApiDocument).toMatchObject(document.document.serialize());
    });
  });

  describe("updateJobProgress", () => {
    it("sets update properties on the delayed job", async () => {
      const org = await OrganisationFactory.create();
      const document = buildJsonApi(OrganisationLightDto).addData(org.uuid, new OrganisationLightDto(org));
      const delayedJob = await DelayedJobFactory.pending.create();
      const processor = new (class ProgressWorker extends DelayedJobWorker<DelayedJobData> {
        async processDelayedJob(job: Job<DelayedJobData>) {
          await this.updateJobProgress(job, {
            totalContent: 100,
            processedContent: 0,
            progressMessage: "process begun"
          });

          await delayedJob.reload();
          expect(delayedJob.totalContent).toBe(100);
          expect(delayedJob.progressMessage).toBe("process begun");
          expect(delayedJob.processedContent).toBe(0);

          await this.updateJobProgress(job, { processedContent: 50, progressMessage: "in progress" });
          await delayedJob.reload();
          expect(delayedJob.totalContent).toBe(100);
          expect(delayedJob.progressMessage).toBe("in progress");
          expect(delayedJob.processedContent).toBe(50);

          return { payload: document, processedContent: 100, progressMessage: "process complete" };
        }
      })();
      await processor.process({ data: { delayedJobId: delayedJob.id } } as Job<DelayedJobData>);

      await delayedJob.reload();
      expect(delayedJob.totalContent).toBe(100);
      expect(delayedJob.progressMessage).toBe("process complete");
      expect(delayedJob.processedContent).toBe(100);
      expect(delayedJob.payload as JsonApiDocument).toMatchObject(document.document.serialize());
    });
  });
});

import { Test, TestingModule } from "@nestjs/testing";
import { createMock, DeepMocked } from "@golevelup/ts-jest";
import { Job } from "bullmq";
import { DelayedJob } from "@terramatch-microservices/database/entities";
import { DelayedJobException } from "@terramatch-microservices/common/workers/delayed-job-worker.processor";
import {
  ValidationProcessor,
  PolygonValidationJobData,
  ProjectValidationJobData,
  SiteValidationJobData
} from "./validation.processor";
import { ValidationService } from "./validation.service";

describe("ValidationProcessor", () => {
  let processor: ValidationProcessor;
  let validationService: DeepMocked<ValidationService>;

  beforeEach(async () => {
    jest.spyOn(DelayedJob, "update").mockResolvedValue([0, []] as never);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ValidationProcessor,
        {
          provide: ValidationService,
          useValue: (validationService = createMock<ValidationService>())
        }
      ]
    }).compile();

    processor = module.get(ValidationProcessor);
    validationService.validatePolygonsBatch.mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  describe("processDelayedJob (polygon validation)", () => {
    it("throws DelayedJobException when polygon UUID list is empty", async () => {
      const job = {
        data: {
          polygonUuids: [],
          validationTypes: ["POLYGON_SIZE"],
          delayedJobId: 1
        }
      } as Partial<Job<PolygonValidationJobData>> as Job<PolygonValidationJobData>;

      await expect(processor.processDelayedJob(job)).rejects.toThrow(DelayedJobException);
      expect(validationService.validatePolygonsBatch).not.toHaveBeenCalled();
    });

    it("validates a single batch and includes siteUuid in summary payload", async () => {
      const job = {
        data: {
          polygonUuids: ["a", "b"],
          validationTypes: ["POLYGON_SIZE"],
          delayedJobId: 7,
          siteUuid: "site-uuid-1"
        }
      } as Partial<Job<PolygonValidationJobData>> as Job<PolygonValidationJobData>;

      const result = await processor.processDelayedJob(job);

      expect(validationService.validatePolygonsBatch).toHaveBeenCalledTimes(1);
      expect(validationService.validatePolygonsBatch).toHaveBeenCalledWith(["a", "b"], ["POLYGON_SIZE"]);
      expect(DelayedJob.update).toHaveBeenCalled();
      expect(result.processedContent).toBe(2);
      expect(result.progressMessage).toBe("Completed validation of 2 polygons");
      expect(result.payload).toBeDefined();
    });

    it("completes when siteUuid is omitted (summary uses null siteUuid)", async () => {
      const job = {
        data: {
          polygonUuids: ["only-one"],
          validationTypes: ["POLYGON_SIZE"],
          delayedJobId: 2
        }
      } as Partial<Job<PolygonValidationJobData>> as Job<PolygonValidationJobData>;

      const result = await processor.processDelayedJob(job);

      expect(validationService.validatePolygonsBatch).toHaveBeenCalledWith(["only-one"], ["POLYGON_SIZE"]);
      expect(result.processedContent).toBe(1);
      expect(result.payload).toBeDefined();
    });

    it("processes more than 50 polygons in multiple batches", async () => {
      const polygonUuids = Array.from({ length: 51 }, (_, i) => `p-${i}`);
      const job = {
        data: {
          polygonUuids,
          validationTypes: ["POLYGON_SIZE"],
          delayedJobId: 3,
          siteUuid: "site-2"
        }
      } as Partial<Job<PolygonValidationJobData>> as Job<PolygonValidationJobData>;

      const result = await processor.processDelayedJob(job);

      expect(validationService.validatePolygonsBatch).toHaveBeenCalledTimes(2);
      expect(validationService.validatePolygonsBatch).toHaveBeenNthCalledWith(1, polygonUuids.slice(0, 50), [
        "POLYGON_SIZE"
      ]);
      expect(validationService.validatePolygonsBatch).toHaveBeenNthCalledWith(2, polygonUuids.slice(50, 51), [
        "POLYGON_SIZE"
      ]);
      expect(result.processedContent).toBe(51);
    });
  });

  describe("processDelayedJob (site validation)", () => {
    it("throws DelayedJobException when the site has no polygons", async () => {
      validationService.getSitePolygonUuids.mockResolvedValue([]);
      const job = {
        data: {
          siteUuid: "site-empty",
          validationTypes: ["POLYGON_SIZE"],
          delayedJobId: 10
        }
      } as Partial<Job<SiteValidationJobData>> as Job<SiteValidationJobData>;

      await expect(processor.processDelayedJob(job)).rejects.toThrow(DelayedJobException);
      expect(validationService.getSitePolygonUuids).toHaveBeenCalledWith("site-empty");
      expect(validationService.validatePolygonsBatch).not.toHaveBeenCalled();
    });

    it("validates site polygons in one batch and returns summary payload", async () => {
      validationService.getSitePolygonUuids.mockResolvedValue(["u1", "u2"]);
      const job = {
        data: {
          siteUuid: "site-full",
          validationTypes: ["POLYGON_SIZE"],
          delayedJobId: 11
        }
      } as Partial<Job<SiteValidationJobData>> as Job<SiteValidationJobData>;

      const result = await processor.processDelayedJob(job);

      expect(validationService.validatePolygonsBatch).toHaveBeenCalledTimes(1);
      expect(validationService.validatePolygonsBatch).toHaveBeenCalledWith(["u1", "u2"], ["POLYGON_SIZE"]);
      expect(result.processedContent).toBe(2);
      expect(result.progressMessage).toBe("Completed validation of 2 polygons");
      expect(result.payload).toBeDefined();
    });

    it("splits site polygons into batches of 50", async () => {
      const uuids = Array.from({ length: 51 }, (_, i) => `s-${i}`);
      validationService.getSitePolygonUuids.mockResolvedValue(uuids);
      const job = {
        data: {
          siteUuid: "site-big",
          validationTypes: ["POLYGON_SIZE"],
          delayedJobId: 12
        }
      } as Partial<Job<SiteValidationJobData>> as Job<SiteValidationJobData>;

      const result = await processor.processDelayedJob(job);

      expect(validationService.validatePolygonsBatch).toHaveBeenCalledTimes(2);
      expect(validationService.validatePolygonsBatch).toHaveBeenNthCalledWith(1, uuids.slice(0, 50), ["POLYGON_SIZE"]);
      expect(validationService.validatePolygonsBatch).toHaveBeenNthCalledWith(2, uuids.slice(50, 51), ["POLYGON_SIZE"]);
      expect(result.processedContent).toBe(51);
    });
  });

  describe("processDelayedJob (project validation)", () => {
    it("throws DelayedJobException when the project has no polygons", async () => {
      validationService.getProjectPolygonUuidsForValidation.mockResolvedValue([]);
      const job = {
        data: {
          projectId: 99,
          validationTypes: ["POLYGON_SIZE"],
          delayedJobId: 20
        }
      } as Partial<Job<ProjectValidationJobData>> as Job<ProjectValidationJobData>;

      await expect(processor.processDelayedJob(job)).rejects.toThrow(DelayedJobException);
      expect(validationService.getProjectPolygonUuidsForValidation).toHaveBeenCalledWith(99);
      expect(validationService.validatePolygonsBatch).not.toHaveBeenCalled();
    });

    it("validates project polygons in one batch and returns summary with project id", async () => {
      validationService.getProjectPolygonUuidsForValidation.mockResolvedValue(["p1"]);
      const job = {
        data: {
          projectId: 5,
          validationTypes: ["POLYGON_SIZE"],
          delayedJobId: 21
        }
      } as Partial<Job<ProjectValidationJobData>> as Job<ProjectValidationJobData>;

      const result = await processor.processDelayedJob(job);

      expect(validationService.validatePolygonsBatch).toHaveBeenCalledWith(["p1"], ["POLYGON_SIZE"]);
      expect(result.processedContent).toBe(1);
      expect(result.progressMessage).toBe("Completed validation of 1 polygons");
      expect(result.payload).toBeDefined();
    });

    it("splits project polygons into batches of 50", async () => {
      const uuids = Array.from({ length: 52 }, (_, i) => `proj-${i}`);
      validationService.getProjectPolygonUuidsForValidation.mockResolvedValue(uuids);
      const job = {
        data: {
          projectId: 3,
          validationTypes: ["POLYGON_SIZE"],
          delayedJobId: 22
        }
      } as Partial<Job<ProjectValidationJobData>> as Job<ProjectValidationJobData>;

      const result = await processor.processDelayedJob(job);

      expect(validationService.validatePolygonsBatch).toHaveBeenCalledTimes(2);
      expect(validationService.validatePolygonsBatch).toHaveBeenNthCalledWith(1, uuids.slice(0, 50), ["POLYGON_SIZE"]);
      expect(validationService.validatePolygonsBatch).toHaveBeenNthCalledWith(2, uuids.slice(50, 52), ["POLYGON_SIZE"]);
      expect(result.processedContent).toBe(52);
    });
  });
});

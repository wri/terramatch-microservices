import { Test, TestingModule } from "@nestjs/testing";
import { createMock, DeepMocked } from "@golevelup/ts-jest";
import { Job } from "bullmq";
import { ClippingProcessor, ClippingJobData } from "./polygon-clipping.processor";
import { PolygonClippingService } from "./polygon-clipping.service";
import { DelayedJobException } from "@terramatch-microservices/common/workers/delayed-job-worker.processor";

describe("ClippingProcessor", () => {
  let processor: ClippingProcessor;
  let clippingService: DeepMocked<PolygonClippingService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClippingProcessor,
        {
          provide: PolygonClippingService,
          useValue: (clippingService = createMock<PolygonClippingService>())
        }
      ]
    }).compile();

    processor = module.get<ClippingProcessor>(ClippingProcessor);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("processDelayedJob", () => {
    it("should throw DelayedJobException when no polygon UUIDs provided", async () => {
      const job = {
        data: {
          polygonUuids: [],
          userId: 1,
          userFullName: "Test User",
          source: "terramatch",
          delayedJobId: 1
        }
      } as Partial<Job<ClippingJobData>> as Job<ClippingJobData>;

      await expect(processor.processDelayedJob(job)).rejects.toThrow(DelayedJobException);
      expect(clippingService.clipAndCreateVersions).not.toHaveBeenCalled();
    });

    it("should throw DelayedJobException when no fixable polygons found", async () => {
      const job = {
        data: {
          polygonUuids: ["polygon-uuid-1"],
          userId: 1,
          userFullName: "Test User",
          source: "terramatch",
          delayedJobId: 1
        }
      } as Partial<Job<ClippingJobData>> as Job<ClippingJobData>;

      clippingService.clipAndCreateVersions.mockResolvedValue([]);

      await expect(processor.processDelayedJob(job)).rejects.toThrow(DelayedJobException);
      expect(clippingService.clipAndCreateVersions).toHaveBeenCalledWith(
        ["polygon-uuid-1"],
        1,
        "Test User",
        "terramatch"
      );
    });

    it("should successfully process clipping job", async () => {
      const job = {
        data: {
          polygonUuids: ["polygon-uuid-1", "polygon-uuid-2"],
          userId: 1,
          userFullName: "Test User",
          source: "terramatch",
          delayedJobId: 1
        }
      } as Partial<Job<ClippingJobData>> as Job<ClippingJobData>;

      const createdVersions = [
        {
          uuid: "version-uuid-1",
          polyName: "Test Polygon 1",
          originalArea: 10.5,
          newArea: 10.2,
          areaRemoved: 0.3
        },
        {
          uuid: "version-uuid-2",
          polyName: "Test Polygon 2",
          originalArea: 5.2,
          newArea: 5.0,
          areaRemoved: 0.2
        }
      ];

      clippingService.clipAndCreateVersions.mockResolvedValue(createdVersions);

      const result = await processor.processDelayedJob(job);

      expect(clippingService.clipAndCreateVersions).toHaveBeenCalledWith(
        ["polygon-uuid-1", "polygon-uuid-2"],
        1,
        "Test User",
        "terramatch"
      );
      expect(result.processedContent).toBe(2);
      expect(result.progressMessage).toBe("Completed clipping of 2 polygons");
      expect(result.payload).toBeDefined();
    });

    it("should handle null userFullName", async () => {
      const job = {
        data: {
          polygonUuids: ["polygon-uuid-1"],
          userId: 1,
          userFullName: null,
          source: "terramatch",
          delayedJobId: 1
        }
      } as Partial<Job<ClippingJobData>> as Job<ClippingJobData>;

      const createdVersions = [
        {
          uuid: "version-uuid-1",
          polyName: "Test Polygon",
          originalArea: 10.5,
          newArea: 10.2,
          areaRemoved: 0.3
        }
      ];

      clippingService.clipAndCreateVersions.mockResolvedValue(createdVersions);

      const result = await processor.processDelayedJob(job);

      expect(clippingService.clipAndCreateVersions).toHaveBeenCalledWith(["polygon-uuid-1"], 1, null, "terramatch");
      expect(result.processedContent).toBe(1);
    });

    it("should update job progress during processing", async () => {
      const job = {
        data: {
          polygonUuids: ["polygon-uuid-1", "polygon-uuid-2"],
          userId: 1,
          userFullName: "Test User",
          source: "terramatch",
          delayedJobId: 1
        }
      } as Partial<Job<ClippingJobData>> as Job<ClippingJobData>;

      const createdVersions = [
        {
          uuid: "version-uuid-1",
          polyName: "Test Polygon",
          originalArea: 10.5,
          newArea: 10.2,
          areaRemoved: 0.3
        }
      ];

      clippingService.clipAndCreateVersions.mockResolvedValue(createdVersions);

      const result = await processor.processDelayedJob(job);

      expect(result.processedContent).toBe(1);
      expect(result.progressMessage).toBe("Completed clipping of 1 polygons");
    });
  });
});

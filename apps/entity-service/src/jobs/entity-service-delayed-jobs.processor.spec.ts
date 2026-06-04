import { Test, TestingModule } from "@nestjs/testing";
import {
  EntityExportJobData,
  EntityServiceDelayedJobsProcessor,
  MEDIA_EXPORT,
  MediaExportJobData,
  PROJECT_EXPORT
} from "./entity-service-delayed-jobs.processor";
import { createMock, DeepMocked } from "@golevelup/ts-jest";
import { EntitiesService } from "../entities/entities.service";
import { FileService } from "@terramatch-microservices/common/file/file.service";
import { ConfigService } from "@nestjs/config";
import { Job } from "bullmq";
import { StubProcessor } from "../entities/entities.controller.spec";
import { DelayedJobException } from "@terramatch-microservices/common/workers/delayed-job-worker.processor";
import { serialize } from "@terramatch-microservices/common/util/testing";
import { Resource } from "@terramatch-microservices/common/util";
import { PassThrough } from "node:stream";

describe("EntityServiceDelayedJobsProcessor", () => {
  let module: TestingModule;
  const service = () => module.get(EntityServiceDelayedJobsProcessor);
  const configService = (): DeepMocked<ConfigService> => module.get(ConfigService);
  const entityService = (): DeepMocked<EntitiesService> => module.get(EntitiesService);
  const fileService = (): DeepMocked<FileService> => module.get(FileService);

  beforeEach(async () => {
    module = await Test.createTestingModule({
      providers: [
        EntityServiceDelayedJobsProcessor,
        { provide: EntitiesService, useValue: createMock<EntitiesService>() },
        { provide: FileService, useValue: createMock<FileService>() },
        {
          provide: ConfigService,
          useValue: createMock<ConfigService>({
            get(key: string) {
              if (key === "AWS_BUCKET") return "test-bucket";
              return "";
            }
          })
        }
      ]
    }).compile();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("processDelayedJob", () => {
    it("throws if the job name is unknown", async () => {
      await expect(service().processDelayedJob({ name: "unknown" } as Job<EntityExportJobData>)).rejects.toThrow(
        "Unsupported job name: unknown"
      );
    });
  });

  describe("processEntityExport", () => {
    it("throws if the bucket is undefined", async () => {
      configService().get.mockReturnValue(undefined);
      await expect(
        service().processDelayedJob({
          name: PROJECT_EXPORT,
          data: { projectName: "foo", projectUuid: "bar" }
        } as Job<EntityExportJobData>)
      ).rejects.toThrow("AWS_BUCKET configuration is missing");
    });

    it("throws if the processor throws", async () => {
      const processor = new StubProcessor(entityService(), "projects");
      processor.export.mockRejectedValue(new Error("Processor error"));
      entityService().createEntityProcessor.mockReturnValue(processor);
      fileService().uploadStream.mockImplementation(async (bucket, fileName, mime, writer) => {
        await writer(new PassThrough());
      });
      await expect(
        service().processDelayedJob({
          name: PROJECT_EXPORT,
          data: { projectName: "foo", projectUuid: "bar" }
        } as Job<EntityExportJobData>)
      ).rejects.toThrow(DelayedJobException);
    });

    it("calls the processor and returns a file download", async () => {
      const processor = new StubProcessor(entityService(), "projects");
      entityService().createEntityProcessor.mockReturnValue(processor);
      fileService().uploadStream.mockImplementation(async (bucket, fileName, mime, writer) => {
        await writer(new PassThrough());
      });
      const result = serialize(
        (
          await service().processDelayedJob({
            name: PROJECT_EXPORT,
            data: { projectName: "Restore Dune", projectUuid: "fake-uuid" }
          } as Job<EntityExportJobData>)
        ).payload
      );
      expect(processor.export).toHaveBeenCalledWith("fake-uuid", expect.anything());
      expect((result.data as Resource).id).toBe("projectExport|fake-uuid");
      expect(fileService().generatePresignedUrl).toHaveBeenCalledWith(
        "test-bucket",
        expect.stringContaining("Restore Dune")
      );
    });
  });

  describe("processMediaExport", () => {
    it("throws if the processor throws", async () => {
      const processor = new StubProcessor(entityService(), "projects");
      processor.exportMedia.mockRejectedValue(new Error("Processor error"));
      entityService().createEntityProcessor.mockReturnValue(processor);
      fileService().uploadStream.mockImplementation(async (bucket, fileName, mime, writer) => {
        await writer(new PassThrough());
      });
      await expect(
        service().processDelayedJob({
          name: MEDIA_EXPORT,
          data: { entityType: "projects", entityUuid: "fake-uuid", entityName: "Restoring Dune", totalContent: 0 }
        } as Job<MediaExportJobData>)
      ).rejects.toThrow(DelayedJobException);
    });

    it("calls the processor and returns a file download", async () => {
      const processor = new StubProcessor(entityService(), "projects");
      // @ts-expect-error incomplete mock definition in the stub
      processor.exportMedia.mockImplementation(async (uuids, target, progressTick) => {
        progressTick?.(6);
      });
      entityService().createEntityProcessor.mockReturnValue(processor);
      fileService().uploadStream.mockImplementation(async (bucket, fileName, mime, writer) => {
        await writer(new PassThrough());
      });
      // @ts-expect-error updateJobProgress is protected
      jest.spyOn(service(), "updateJobProgress").mockResolvedValue(undefined);
      const result = serialize(
        (
          await service().processDelayedJob({
            name: MEDIA_EXPORT,
            data: { entityType: "projects", entityUuid: "fake-uuid", entityName: "Restoring Dune", totalContent: 6 }
          } as Job<MediaExportJobData>)
        ).payload
      );
      expect(processor.exportMedia).toHaveBeenCalledWith(["fake-uuid"], expect.anything(), expect.any(Function));
      expect((result.data as Resource).id).toBe("mediaExport|projects|fake-uuid");
      expect(fileService().generatePresignedUrl).toHaveBeenCalledWith(
        "test-bucket",
        expect.stringContaining("Restoring Dune")
      );
    });
  });
});

import { Test, TestingModule } from "@nestjs/testing";
import {
  EntityServiceExportJobData,
  EntityServiceExportsProcessor,
  PROJECT_EXPORT
} from "./entity-service-exports.processor";
import { createMock, DeepMocked } from "@golevelup/ts-jest";
import { EntitiesService } from "../entities/entities.service";
import { FileService } from "@terramatch-microservices/common/file/file.service";
import { ConfigService } from "@nestjs/config";
import { Job } from "bullmq";
import { StubProcessor } from "../entities/entities.controller.spec";
import { DelayedJobException } from "@terramatch-microservices/common/workers/delayed-job-worker.processor";
import { serialize } from "@terramatch-microservices/common/util/testing";
import { Resource } from "@terramatch-microservices/common/util";

describe("EntityServiceExportsProcessor", () => {
  let module: TestingModule;
  const service = () => module.get(EntityServiceExportsProcessor);
  const configService = (): DeepMocked<ConfigService> => module.get(ConfigService);
  const entityService = (): DeepMocked<EntitiesService> => module.get(EntitiesService);
  const fileService = (): DeepMocked<FileService> => module.get(FileService);

  beforeEach(async () => {
    module = await Test.createTestingModule({
      providers: [
        EntityServiceExportsProcessor,
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
      await expect(service().processDelayedJob({ name: "unknown" } as Job<EntityServiceExportJobData>)).rejects.toThrow(
        "Unsupported job name: unknown"
      );
    });

    it("throws if the bucket is undefined", async () => {
      configService().get.mockReturnValue(undefined);
      await expect(
        service().processDelayedJob({ name: PROJECT_EXPORT } as Job<EntityServiceExportJobData>)
      ).rejects.toThrow("AWS_BUCKET configuration is missing");
    });

    it("throws if the processor throws", async () => {
      const processor = new StubProcessor(entityService(), "projects");
      processor.export.mockRejectedValue(new Error("Processor error"));
      entityService().createEntityProcessor.mockReturnValue(processor);
      await expect(
        service().processDelayedJob({ name: PROJECT_EXPORT, data: {} } as Job<EntityServiceExportJobData>)
      ).rejects.toThrow(DelayedJobException);
    });

    it("calls the processor and returns a file download", async () => {
      const processor = new StubProcessor(entityService(), "projects");
      entityService().createEntityProcessor.mockReturnValue(processor);
      const result = serialize(
        (
          await service().processDelayedJob({
            name: PROJECT_EXPORT,
            data: { projectName: "Restore Dune", projectUuid: "fake-uuid" }
          } as Job<EntityServiceExportJobData>)
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
});

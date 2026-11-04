import { Test } from "@nestjs/testing";
import { createMock, DeepMocked } from "@golevelup/ts-jest";
import { ConfigService } from "@nestjs/config";
import { Job, Queue } from "bullmq";
import { PassThrough } from "stream";
import { DelayedJob } from "@terramatch-microservices/database/entities";
import { FileService } from "@terramatch-microservices/common/file/file.service";
import { DelayedJobException } from "@terramatch-microservices/common/workers/delayed-job-worker.processor";
import { GeoJsonExportJobData, GeoJsonExportProcessor } from "./geojson-export.processor";
import { GeoJsonExportService } from "./geojson-export.service";
import { serialize } from "@terramatch-microservices/common/util/testing";
import { Resource } from "@terramatch-microservices/common/util";

describe("GeoJsonExportProcessor", () => {
  let processor: GeoJsonExportProcessor;
  let geoJsonExportService: DeepMocked<GeoJsonExportService>;
  let fileService: DeepMocked<FileService>;
  let configService: DeepMocked<ConfigService>;

  const buildJob = (data: Partial<GeoJsonExportJobData> = {}) =>
    ({
      data: {
        delayedJobId: 1,
        scope: { siteUuids: ["site-uuid"] },
        fileName: "exports/polygon-exports/job-uuid/Site polygons.geojson",
        ...data
      }
    }) as Job<GeoJsonExportJobData>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        GeoJsonExportProcessor,
        { provide: GeoJsonExportService, useValue: (geoJsonExportService = createMock<GeoJsonExportService>()) },
        { provide: FileService, useValue: (fileService = createMock<FileService>()) },
        { provide: ConfigService, useValue: (configService = createMock<ConfigService>()) }
      ]
    }).compile();

    processor = module.get(GeoJsonExportProcessor);
    configService.get.mockReturnValue("test-bucket");
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("queueExport", () => {
    it("creates a delayed job and queues the export under an unguessable key", async () => {
      const queue = createMock<Queue>();

      const result = await GeoJsonExportProcessor.queueExport(
        queue,
        { projectUuids: ["project-uuid"] },
        "Restoration Project",
        "App\\Models\\V2\\Projects\\Project"
      );

      const delayedJob = await DelayedJob.findOne({ where: { uuid: (serialize(result).data as Resource).id } });
      expect(delayedJob).not.toBeNull();
      expect(delayedJob?.name).toBe("Polygon GeoJSON Export");
      expect(delayedJob?.metadata).toEqual({
        entity_type: "App\\Models\\V2\\Projects\\Project",
        entity_name: "Restoration Project"
      });

      const [name, data] = queue.add.mock.calls[0];
      expect(name).toBe("geojsonExport");
      expect(data).toMatchObject({ delayedJobId: delayedJob?.id, scope: { projectUuids: ["project-uuid"] } });
      expect((data as GeoJsonExportJobData).fileName).toMatch(
        new RegExp(`^exports/polygon-exports/${delayedJob?.uuid}/Restoration Project polygons - .+\\.geojson$`)
      );
    });
  });

  describe("processDelayedJob", () => {
    it("streams the export to S3, records progress and returns a signed download URL", async () => {
      const update = jest.spyOn(DelayedJob, "update").mockResolvedValue([1] as never);
      const stream = new PassThrough();
      fileService.uploadStream.mockImplementation(async (_bucket, _key, _mimeType, writer) => {
        await writer(stream);
      });
      geoJsonExportService.writeFeatureCollection.mockImplementation(async (_destination, _scope, onProgress) => {
        await onProgress(2, 2);
      });
      fileService.generatePresignedUrl.mockResolvedValue("https://signed.example/export.geojson");
      const job = buildJob();

      const result = await processor.processDelayedJob(job);

      expect(fileService.uploadStream).toHaveBeenCalledWith(
        "test-bucket",
        job.data.fileName,
        "application/geo+json",
        expect.any(Function)
      );
      expect(geoJsonExportService.writeFeatureCollection).toHaveBeenCalledWith(
        stream,
        { siteUuids: ["site-uuid"] },
        expect.any(Function)
      );
      expect(update).toHaveBeenCalledWith({ processedContent: 2, totalContent: 2 }, { where: { id: 1 } });
      expect(stream.writableEnded).toBe(true);
      expect(fileService.generatePresignedUrl).toHaveBeenCalledWith("test-bucket", job.data.fileName, {
        asAttachment: true
      });
      expect(serialize(result.payload)).toMatchObject({
        data: {
          type: "fileDownloads",
          id: "geojsonExport|1",
          attributes: { url: "https://signed.example/export.geojson" }
        }
      });
    });

    it("ends the stream and fails the job when the export fails", async () => {
      const stream = new PassThrough();
      fileService.uploadStream.mockImplementation(async (_bucket, _key, _mimeType, writer) => {
        await writer(stream);
      });
      geoJsonExportService.writeFeatureCollection.mockRejectedValue(new Error("DB down"));

      await expect(processor.processDelayedJob(buildJob())).rejects.toThrow(
        new DelayedJobException(500, "Failed to export polygons: DB down")
      );
      expect(stream.writableEnded).toBe(true);
      expect(fileService.generatePresignedUrl).not.toHaveBeenCalled();
    });

    it("fails the job when the upload fails", async () => {
      fileService.uploadStream.mockRejectedValue(new Error("S3 unavailable"));

      await expect(processor.processDelayedJob(buildJob())).rejects.toThrow(
        new DelayedJobException(500, "Failed to export polygons: S3 unavailable")
      );
      expect(fileService.generatePresignedUrl).not.toHaveBeenCalled();
    });

    it("fails the job when the bucket is not configured", async () => {
      configService.get.mockReturnValue(undefined);

      await expect(processor.processDelayedJob(buildJob())).rejects.toThrow("AWS_BUCKET configuration is missing");
      expect(fileService.uploadStream).not.toHaveBeenCalled();
    });
  });
});

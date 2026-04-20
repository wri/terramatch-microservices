import {
  ORGANISATIONS_EXPORT,
  UserServiceExportJobData,
  UserServiceExportsProcessor
} from "./user-service-exports.processor";
import { Test } from "@nestjs/testing";
import { CsvExportService } from "@terramatch-microservices/common/export/csv-export.service";
import { createMock, DeepMocked } from "@golevelup/ts-jest";
import { MediaService } from "@terramatch-microservices/common/media/media.service";
import { Job } from "bullmq";
import { Media, Organisation } from "@terramatch-microservices/database/entities";
import { MediaFactory, OrganisationFactory } from "@terramatch-microservices/database/factories";
import { DelayedJobException } from "@terramatch-microservices/common/workers/delayed-job-worker.processor";
import { serialize } from "@terramatch-microservices/common/util/testing";
import { Resource } from "@terramatch-microservices/common/util";
import { FileDownloadDto } from "@terramatch-microservices/common/dto/file-download.dto";

describe("UserServiceExportsProcessor", () => {
  let processor: UserServiceExportsProcessor;
  let csvExportService: DeepMocked<CsvExportService>;
  let mediaService: DeepMocked<MediaService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        UserServiceExportsProcessor,
        { provide: CsvExportService, useValue: createMock<CsvExportService>() },
        { provide: MediaService, useValue: createMock<MediaService>() }
      ]
    }).compile();

    processor = module.get(UserServiceExportsProcessor);
    csvExportService = module.get(CsvExportService);
    mediaService = module.get(MediaService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("processDelayedJob", () => {
    it("throws if the job name is unexpected", async () => {
      await expect(
        processor.processDelayedJob({ name: "unexpected-job" } as Job<UserServiceExportJobData>)
      ).rejects.toThrow("Unsupported job name: unexpected-job");
    });

    it("throws if the batch find process fails", async () => {
      await OrganisationFactory.create();
      jest.spyOn(Media, "findAll").mockRejectedValue(new Error("Media find failed"));
      await expect(
        processor.processDelayedJob({
          name: ORGANISATIONS_EXPORT,
          data: { fileName: "test.csv", delayedJobId: 1 }
        } as Job<UserServiceExportJobData>)
      ).rejects.toThrow(DelayedJobException);
    });

    it("sends all organisations to the CSV", async () => {
      await Organisation.truncate();
      const orgs = [await OrganisationFactory.create(), await OrganisationFactory.create()];
      // should be ignored.
      await OrganisationFactory.create({ isTest: true });

      const cover = await MediaFactory.org(orgs[1]).create({ collectionName: "cover" });
      const agreement = await MediaFactory.org(orgs[1]).create({
        collectionName: "consortium_partnership_agreements"
      });

      const addRow = jest.fn();
      const close = jest.fn();
      csvExportService.getS3StreamWriter.mockReturnValue({ addRow, close });
      csvExportService.generateExportDto.mockResolvedValue(new FileDownloadDto("test.csv"));

      mediaService.getUrl.mockReturnValue("file-url");

      const result = await processor.processDelayedJob({
        name: ORGANISATIONS_EXPORT,
        data: { fileName: "test.csv", delayedJobId: 1 }
      } as Job<UserServiceExportJobData>);

      const payload = serialize(result.payload);
      expect(payload.data).toBeDefined();
      expect((payload.data as Resource).type).toBe("fileDownloads");
      expect((payload.data as Resource).id).toBe("organisationsExport");

      expect(close).toHaveBeenCalled();

      expect(addRow).toHaveBeenCalledTimes(2);
      expect(addRow).toHaveBeenNthCalledWith(1, expect.objectContaining({ uuid: orgs[0].uuid }), {});
      expect(addRow).toHaveBeenNthCalledWith(2, expect.objectContaining({ uuid: orgs[1].uuid }), {
        cover: "file-url",
        consortium_partnership_agreements: "file-url"
      });

      expect(mediaService.getUrl).toHaveBeenCalledTimes(2);
      expect(mediaService.getUrl).toHaveBeenCalledWith(expect.objectContaining({ uuid: cover.uuid }));
      expect(mediaService.getUrl).toHaveBeenCalledWith(expect.objectContaining({ uuid: agreement.uuid }));
    });
  });
});

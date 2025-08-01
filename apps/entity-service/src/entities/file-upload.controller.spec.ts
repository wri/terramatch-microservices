jest.mock("@terramatch-microservices/common/util/json-api-builder", () => ({
  buildJsonApi: jest.fn()
}));

import { Test, TestingModule } from "@nestjs/testing";
import { UnauthorizedException, NotFoundException } from "@nestjs/common";
import { FileUploadController } from "./file-upload.controller";
import { FileUploadService, ExtractedRequestData } from "../file/file-upload.service";
import { PolicyService } from "@terramatch-microservices/common/policies/policy.service";
import { MediaService } from "@terramatch-microservices/common/media/media.service";
import { EntitiesService } from "./entities.service";
import { MediaDto } from "./dto/media.dto";
import { MediaCollectionEntityDto } from "./dto/media-collection-entity.dto";
import { Media } from "@terramatch-microservices/database/entities/media.entity";
import { buildJsonApi } from "@terramatch-microservices/common/util/json-api-builder";

describe("FileUploadController", () => {
  let controller: FileUploadController;
  let fileUploadService: jest.Mocked<FileUploadService>;
  let policyService: jest.Mocked<PolicyService>;
  let mediaService: jest.Mocked<MediaService>;
  let entitiesService: jest.Mocked<EntitiesService>;
  let mockMediaOwnerProcessor: { getBaseEntity: jest.Mock };
  let docMock: { addData: jest.Mock; serialize: jest.Mock };

  beforeEach(async () => {
    fileUploadService = { uploadFile: jest.fn() } as unknown as jest.Mocked<FileUploadService>;
    policyService = { authorize: jest.fn() } as unknown as jest.Mocked<PolicyService>;
    mediaService = { getUrl: jest.fn() } as unknown as jest.Mocked<MediaService>;
    mockMediaOwnerProcessor = { getBaseEntity: jest.fn() };
    entitiesService = {
      createMediaOwnerProcessor: jest.fn().mockReturnValue(mockMediaOwnerProcessor),
      userId: "user-uuid"
    } as unknown as jest.Mocked<EntitiesService>;

    docMock = {
      addData: jest.fn(),
      serialize: jest.fn().mockReturnValue({ data: "serialized-response" })
    };
    (buildJsonApi as jest.Mock).mockReturnValue(docMock);

    const module: TestingModule = await Test.createTestingModule({
      controllers: [FileUploadController],
      providers: [
        { provide: FileUploadService, useValue: fileUploadService },
        { provide: PolicyService, useValue: policyService },
        { provide: MediaService, useValue: mediaService },
        { provide: EntitiesService, useValue: entitiesService }
      ]
    }).compile();

    controller = module.get<FileUploadController>(FileUploadController);
  });

  describe("uploadFile", () => {
    const params: MediaCollectionEntityDto = {
      entity: "projects",
      uuid: "entity-uuid",
      collection: "collectionName"
    };
    const body: ExtractedRequestData = { isPublic: true, lat: 0, lng: 0 };
    const file: Partial<Express.Multer.File> = {
      fieldname: "uploadFile",
      originalname: "file.png",
      encoding: "7bit",
      mimetype: "image/png",
      size: 123,
      buffer: Buffer.from("")
    };

    it("should upload file successfully", async () => {
      const model = { uuid: "model-uuid", id: 1 };
      mockMediaOwnerProcessor.getBaseEntity.mockResolvedValue(model);
      policyService.authorize.mockResolvedValue(undefined);
      const media: Media = { uuid: "media-uuid" } as Media;
      fileUploadService.uploadFile.mockResolvedValue(media);
      mediaService.getUrl.mockImplementation((m: Media, conversion?: string) =>
        conversion != null ? `thumbUrl/${m.uuid}` : `url/${m.uuid}`
      );

      const result = await controller.uploadFile(params, file as Express.Multer.File, body);

      expect(entitiesService.createMediaOwnerProcessor).toHaveBeenCalledWith(params.entity, params.uuid);
      expect(mockMediaOwnerProcessor.getBaseEntity).toHaveBeenCalled();
      expect(policyService.authorize).toHaveBeenCalledWith("uploadFiles", model);
      expect(fileUploadService.uploadFile).toHaveBeenCalledWith(model, params.entity, params.collection, file, body);
      expect(buildJsonApi).toHaveBeenCalledWith(MediaDto);
      expect(docMock.addData).toHaveBeenCalledWith(media.uuid, expect.any(MediaDto));
      expect(docMock.serialize).toHaveBeenCalled();
      expect(result).toEqual({ data: "serialized-response" });
    });

    it("should throw UnauthorizedException when authorization fails", async () => {
      mockMediaOwnerProcessor.getBaseEntity.mockResolvedValue({ uuid: "model-uuid", id: 1 });
      policyService.authorize.mockRejectedValue(new UnauthorizedException("not allowed"));

      await expect(controller.uploadFile(params, file as Express.Multer.File, body)).rejects.toThrow(
        UnauthorizedException
      );
      expect(fileUploadService.uploadFile).not.toHaveBeenCalled();
    });

    it("should throw NotFoundException when entity not found", async () => {
      mockMediaOwnerProcessor.getBaseEntity.mockRejectedValue(new NotFoundException("not found"));

      await expect(controller.uploadFile(params, file as Express.Multer.File, body)).rejects.toThrow(NotFoundException);
      expect(policyService.authorize).not.toHaveBeenCalled();
      expect(fileUploadService.uploadFile).not.toHaveBeenCalled();
    });
  });
});

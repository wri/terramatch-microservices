/* eslint-disable @typescript-eslint/no-explicit-any */
import { serialize } from "@terramatch-microservices/common/util/testing";
import { Test, TestingModule } from "@nestjs/testing";
import { NotFoundException, UnauthorizedException } from "@nestjs/common";
import { FilesController } from "./files.controller";
import { PolicyService } from "@terramatch-microservices/common/policies/policy.service";
import { MediaService } from "@terramatch-microservices/common/media/media.service";
import { EntitiesService } from "./entities.service";
import { MediaCollectionEntityDto } from "./dto/media-collection-entity.dto";
import { Media } from "@terramatch-microservices/database/entities/media.entity";
import { Resource } from "@terramatch-microservices/common/util";
import { MediaRequestBody } from "./dto/media-request.dto";
import { Project } from "@terramatch-microservices/database/entities";
import { getBaseEntityByLaravelTypeAndId } from "./processors/media-owner-processor";
import { EntityType } from "@slack/web-api/dist/methods";

jest.mock("./processors/media-owner-processor", () => ({
  getBaseEntityByLaravelTypeAndId: jest.fn()
}));

describe("FilesController", () => {
  let controller: FilesController;
  let policyService: jest.Mocked<PolicyService>;
  let mediaService: jest.Mocked<MediaService>;
  let entitiesService: jest.Mocked<EntitiesService>;
  let mockMediaOwnerProcessor: { getBaseEntity: jest.Mock };

  beforeEach(async () => {
    jest.clearAllMocks();

    policyService = {
      authorize: jest.fn(),
      getPermissions: jest.fn()
    } as unknown as jest.Mocked<PolicyService>;
    mediaService = {
      getUrl: jest.fn(),
      getMedia: jest.fn(),
      createMedia: jest.fn(),
      deleteMediaByUuid: jest.fn(),
      deleteMedia: jest.fn(),
      getMedias: jest.fn(),
      updateMedia: jest.fn(),
      getProjectForModel: jest.fn(),
      unsetMediaCoverForProject: jest.fn()
    } as unknown as jest.Mocked<MediaService>;
    mockMediaOwnerProcessor = { getBaseEntity: jest.fn() };
    entitiesService = {
      createMediaOwnerProcessor: jest.fn().mockReturnValue(mockMediaOwnerProcessor),
      userId: 1,
      mediaDto: jest.fn()
    } as unknown as jest.Mocked<EntitiesService>;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [FilesController],
      providers: [
        { provide: PolicyService, useValue: policyService },
        { provide: MediaService, useValue: mediaService },
        { provide: EntitiesService, useValue: entitiesService }
      ]
    }).compile();

    controller = module.get<FilesController>(FilesController);
  });

  describe("getMedia", () => {
    it("should get the media successfully", async () => {
      const media = { uuid: "media-uuid" } as Media;
      policyService.authorize.mockResolvedValue(undefined);
      mediaService.getMedia.mockResolvedValue(media);
      const model = { uuid: "model-uuid", id: 1 };
      (getBaseEntityByLaravelTypeAndId as jest.Mock).mockResolvedValue(model);
      await controller.getMedia({ uuid: "media-uuid" });
      expect(entitiesService.mediaDto).toHaveBeenCalledWith(media, {
        entityType: media.modelType as EntityType,
        entityUuid: model.uuid
      });
    });
  });

  describe("uploadFile", () => {
    const params: MediaCollectionEntityDto = {
      entity: "projects",
      uuid: "entity-uuid",
      collection: "collectionName"
    };
    const body: MediaRequestBody = {
      data: { type: "media", attributes: { isPublic: true, lat: 0, lng: 0 } }
    } as MediaRequestBody;
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
      mediaService.createMedia.mockResolvedValue(media);
      mediaService.getUrl.mockImplementation((m: Media, conversion?: string) =>
        conversion != null ? `thumbUrl/${m.uuid}` : `url/${m.uuid}`
      );

      const result = serialize(await controller.uploadFile(params, file as Express.Multer.File, body));

      expect(entitiesService.createMediaOwnerProcessor).toHaveBeenCalledWith(params.entity, params.uuid);
      expect(mockMediaOwnerProcessor.getBaseEntity).toHaveBeenCalled();
      expect(policyService.authorize).toHaveBeenCalledWith("uploadFiles", model);
      expect(mediaService.createMedia).toHaveBeenCalledWith(
        model,
        params.entity,
        1,
        params.collection,
        file,
        body.data.attributes
      );
      expect((result.data as Resource).id).toEqual(media.uuid);
      expect((result.data as Resource).attributes).toMatchObject(media);
    });

    it("should throw UnauthorizedException when authorization fails", async () => {
      mockMediaOwnerProcessor.getBaseEntity.mockResolvedValue({ uuid: "model-uuid", id: 1 });
      policyService.authorize.mockRejectedValue(new UnauthorizedException("not allowed"));

      await expect(controller.uploadFile(params, file as Express.Multer.File, body)).rejects.toThrow(
        UnauthorizedException
      );
      expect(mediaService.createMedia).not.toHaveBeenCalled();
    });

    it("should throw NotFoundException when entity not found", async () => {
      mockMediaOwnerProcessor.getBaseEntity.mockRejectedValue(new NotFoundException("not found"));

      await expect(controller.uploadFile(params, file as Express.Multer.File, body)).rejects.toThrow(NotFoundException);
      expect(policyService.authorize).not.toHaveBeenCalled();
      expect(mediaService.createMedia).not.toHaveBeenCalled();
    });
  });

  describe("mediaUpdate", () => {
    it("should update the media successfully", async () => {
      const mockedMedia = { uuid: "media-uuid" } as Media;
      mediaService.getMedia.mockResolvedValue(mockedMedia);
      policyService.authorize.mockResolvedValue();
      mediaService.updateMedia.mockResolvedValue(mockedMedia);
      const model = { uuid: "model-uuid", id: 1 };
      (getBaseEntityByLaravelTypeAndId as jest.Mock).mockResolvedValue(model);
      await controller.mediaUpdate(
        { uuid: "media-uuid" },
        { data: { type: "media", id: "media-uuid", attributes: { isPublic: true } } }
      );
      expect(policyService.authorize).toHaveBeenCalledWith("updateFiles", { uuid: "model-uuid", id: 1 });
      expect(mediaService.updateMedia).toHaveBeenCalledWith(mockedMedia, {
        data: { type: "media", id: "media-uuid", attributes: { isPublic: true } }
      });
    });

    it("should unset the media cover for the project", async () => {
      const mockedMedia = { uuid: "media-uuid" } as Media;
      const mockedMedia2 = { uuid: "media-uuid-2" } as Media;
      mediaService.getMedia.mockResolvedValue(mockedMedia);
      policyService.authorize.mockResolvedValue();
      (mediaService as any).updateMedia.mockResolvedValue(mockedMedia);
      mediaService.getProjectForModel.mockResolvedValue({ id: 1 } as Project);
      mediaService.unsetMediaCoverForProject.mockResolvedValue([mockedMedia2]);
      await controller.mediaUpdate(
        { uuid: "media-uuid" },
        { data: { type: "media", id: "media-uuid", attributes: { isCover: true } } }
      );
      expect(mediaService.unsetMediaCoverForProject).toHaveBeenCalledWith(mockedMedia, { id: 1 } as Project);
    });
  });

  describe("mediaDelete", () => {
    it("should call the media service to delete the media", async () => {
      mediaService.deleteMediaByUuid = jest.fn();
      mediaService.getMedia.mockResolvedValue({ modelType: Project.LARAVEL_TYPE, modelId: 1 } as Media);
      const model = { uuid: "model-uuid", id: 1 };
      (getBaseEntityByLaravelTypeAndId as jest.Mock).mockResolvedValue(model);
      await controller.mediaDelete({ uuid: "model-uuid" });
      expect(mediaService.deleteMediaByUuid).toHaveBeenCalledWith("model-uuid");
    });

    it("should return the deleted media response", async () => {
      mediaService.getMedia.mockResolvedValue({ modelType: Project.LARAVEL_TYPE, modelId: 1 } as Media);
      const media = await controller.mediaDelete({ uuid: "test-uuid" });
      expect(media).toEqual({ meta: { resourceType: "media", resourceIds: ["test-uuid"] } });
    });
  });

  describe("mediaBulkDelete", () => {
    it("should call the media service to delete the media", async () => {
      policyService.getPermissions.mockResolvedValue(["media-manage"]);
      policyService.authorize.mockResolvedValue();
      const media1: Media = { uuid: "test-uuid-1", createdBy: 123 } as Media;
      const media2: Media = { uuid: "test-uuid-2", createdBy: 123 } as Media;
      mediaService.getMedias.mockResolvedValue([media1, media2]);
      await controller.mediaBulkDelete({ uuids: ["test-uuid1", "test-uuid2"] });
      expect(mediaService.deleteMedia).toHaveBeenCalledWith(media1);
      expect(mediaService.deleteMedia).toHaveBeenCalledWith(media2);
    });

    it("should return the deleted media", async () => {
      policyService.getPermissions.mockResolvedValue(["media-manage"]);
      mediaService.getMedias.mockResolvedValue([{ uuid: "test-uuid" } as Media]);
      const media = await controller.mediaBulkDelete({ uuids: ["test-uuid"] });
      expect(media).toEqual({
        meta: {
          resourceIds: ["test-uuid"],
          resourceType: "media"
        }
      });
    });
  });
});

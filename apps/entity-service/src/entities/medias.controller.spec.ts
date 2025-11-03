import { createMock, DeepMocked } from "@golevelup/ts-jest";
import { Test, TestingModule } from "@nestjs/testing";
import { PolicyService } from "@terramatch-microservices/common";
import { MediaService } from "@terramatch-microservices/common/media/media.service";
import { MediasController } from "./medias.controller";
import { UnauthorizedException } from "@nestjs/common";
import { MediaFactory } from "@terramatch-microservices/database/factories";
import { Media } from "@terramatch-microservices/database/entities";

describe("MediasController", () => {
  let controller: MediasController;
  let mediaService: DeepMocked<MediaService>;
  let policyService: DeepMocked<PolicyService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MediasController],
      providers: [
        { provide: MediaService, useValue: (mediaService = createMock<MediaService>()) },
        { provide: PolicyService, useValue: (policyService = createMock<PolicyService>()) }
      ]
    }).compile();

    controller = module.get(MediasController);
    mediaService = module.get(MediaService);
    policyService = module.get(PolicyService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("mediaDelete", () => {
    it("should call the media service to delete the media", async () => {
      mediaService.deleteMediaByUuid = jest.fn();
      await controller.mediaDelete({ uuid: "test-uuid" });
      expect(mediaService.deleteMediaByUuid).toHaveBeenCalledWith("test-uuid");
    });

    it("should return the deleted media response", async () => {
      const media = await controller.mediaDelete({ uuid: "test-uuid" });
      expect(media).toEqual({ meta: { resourceType: "medias", resourceId: "test-uuid" } });
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
      const media = await controller.mediaBulkDelete({ uuids: ["test-uuid"] });
      expect(media).toEqual({
        meta: {
          resourceId: "test-uuid",
          resourceType: "medias"
        }
      });
    });
  });
});

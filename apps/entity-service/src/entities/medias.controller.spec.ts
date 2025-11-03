import { createMock, DeepMocked } from "@golevelup/ts-jest";
import { Test, TestingModule } from "@nestjs/testing";
import { PolicyService } from "@terramatch-microservices/common";
import { MediaService } from "@terramatch-microservices/common/media/media.service";
import { MediasController } from "./medias.controller";
import { UnauthorizedException } from "@nestjs/common";

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
    it("should throw an error if the policy does not authorize", async () => {
      policyService.authorize.mockRejectedValue(new UnauthorizedException());
      await expect(controller.mediaDelete({ uuid: "test-uuid" })).rejects.toThrow(UnauthorizedException);
    });

    it("should call the media service to delete the media", async () => {
      await controller.mediaDelete({ uuid: "test-uuid" });
      expect(mediaService.deleteMediaByUuid).toHaveBeenCalledWith("test-uuid");
    });

    it("should return the deleted media uuid", async () => {
      const media = await controller.mediaDelete({ uuid: "test-uuid" });
      expect(media).toEqual({ uuid: "test-uuid" });
    });
  });

  describe("mediaBulkDelete", () => {
    it("should throw an error if the policy does not authorize", async () => {
      policyService.authorize.mockRejectedValue(new UnauthorizedException());
      await expect(controller.mediaBulkDelete({ uuids: ["test-uuid"] })).rejects.toThrow(UnauthorizedException);
    });

    it("should call the media service to delete the media", async () => {
      await controller.mediaBulkDelete({ uuids: ["test-uuid"] });
      expect(mediaService.deleteMediaByUuid).toHaveBeenCalledWith("test-uuid");
    });

    it("should return the deleted media", async () => {
      const media = await controller.mediaBulkDelete({ uuids: ["test-uuid"] });
      expect(media).toEqual({ uuids: ["test-uuid"] });
    });
  });
});

import { BadRequestException, InternalServerErrorException } from "@nestjs/common";
import { FileUploadService } from "./file-upload.service";
import { MediaService } from "@terramatch-microservices/common/media/media.service";
import { EntitiesService } from "../entities/entities.service";
import { Media } from "@terramatch-microservices/database/entities/media.entity";
import { User } from "@terramatch-microservices/database/entities/user.entity";
import {
  EntityMediaOwnerClass,
  MediaOwnerModel,
  MediaConfiguration,
  MediaOwnerType,
  MEDIA_OWNER_MODELS
} from "@terramatch-microservices/database/constants/media-owners";
import { ExtraMediaRequestBody } from "../entities/dto/extra-media-request";

describe("FileUploadService", () => {
  let mediaService: jest.Mocked<MediaService>;
  let entitiesService: jest.Mocked<EntitiesService>;
  let service: FileUploadService;

  beforeEach(() => {
    mediaService = { uploadFile: jest.fn() } as unknown as jest.Mocked<MediaService>;
    entitiesService = { userId: 42 } as unknown as jest.Mocked<EntitiesService>;
    service = new FileUploadService(mediaService, entitiesService);
  });

  // Helper for accessing private methods without using `any`
  type PrivateFileUploadService = {
    getMediaType(file: Express.Multer.File): string | undefined;
    getConfiguration(model: EntityMediaOwnerClass<MediaOwnerModel>, collection: string): MediaConfiguration;
    validateFile(file: Express.Multer.File, config: MediaConfiguration): boolean | undefined;
  };

  describe("getMediaType", () => {
    it('should return "documents" for a PDF mimetype', () => {
      const svc = service as unknown as PrivateFileUploadService;
      const file = { mimetype: "application/pdf" } as Express.Multer.File;
      expect(svc.getMediaType(file)).toBe("documents");
    });

    it('should return "media" for a PNG mimetype', () => {
      const svc = service as unknown as PrivateFileUploadService;
      const file = { mimetype: "image/png" } as Express.Multer.File;
      expect(svc.getMediaType(file)).toBe("media");
    });
  });

  describe("getConfiguration", () => {
    const COLLECTION = "testCollection";
    const config: MediaConfiguration = { multiple: false, validation: "documents" };
    let fakeModel: EntityMediaOwnerClass<MediaOwnerModel>;

    beforeEach(() => {
      fakeModel = { MEDIA: { [COLLECTION]: config } } as unknown as EntityMediaOwnerClass<MediaOwnerModel>;
    });

    it("should return the configuration for an existing collection", () => {
      const svc = service as unknown as PrivateFileUploadService;
      expect(svc.getConfiguration(fakeModel, COLLECTION)).toBe(config);
    });

    it("should throw InternalServerErrorException if configuration is missing", () => {
      const svc = service as unknown as PrivateFileUploadService;
      expect(() => svc.getConfiguration(fakeModel, "unknown")).toThrow(
        new InternalServerErrorException(`Configuration for collection unknown not found`)
      );
    });
  });

  describe("validateFile", () => {
    const generalConfig: MediaConfiguration = { multiple: false, validation: "general-documents" };

    it("should do nothing if configuration.validation is not set", () => {
      const svc = service as unknown as PrivateFileUploadService;
      const cfg: MediaConfiguration = { multiple: true, validation: "documents" };
      const file = { mimetype: "any/type", size: 0 } as Express.Multer.File;
      expect(() => svc.validateFile(file, cfg)).toThrow(BadRequestException);
    });

    it("should throw BadRequestException for unsupported mime type", () => {
      const svc = service as unknown as PrivateFileUploadService;
      const file = { mimetype: "application/zip", size: 1 } as Express.Multer.File;
      expect(() => svc.validateFile(file, generalConfig)).toThrow(BadRequestException);
    });

    it("should throw and error when file size is above limit", () => {
      const svc = service as unknown as PrivateFileUploadService;
      const file = { mimetype: "application/pdf", size: 10 * 1024 * 1024 + 1 } as Express.Multer.File;
      expect(() => svc.validateFile(file, generalConfig)).toThrow(BadRequestException);
    });
  });

  describe("uploadFile", () => {
    const COLLECTION = "uploadCollection";
    const ENTITY: MediaOwnerType = "projects";
    const model = { id: 7 } as MediaOwnerModel;
    const body = {
      data: { type: "media", attributes: { isPublic: false, lat: 10, lng: 20, formData: new FormData() } }
    } as ExtraMediaRequestBody;
    let originalModel: EntityMediaOwnerClass<MediaOwnerModel>;
    let file: Express.Multer.File;

    beforeEach(() => {
      originalModel = MEDIA_OWNER_MODELS[ENTITY];
      const cfg: MediaConfiguration = { multiple: false, validation: "documents" };
      const fakeModel = {
        MEDIA: { [COLLECTION]: cfg },
        LARAVEL_TYPE: "laravel"
      } as unknown as EntityMediaOwnerClass<MediaOwnerModel>;
      MEDIA_OWNER_MODELS[ENTITY] = fakeModel;
      file = {
        originalname: "test.txt",
        mimetype: "text/plain",
        size: 123
      } as Express.Multer.File;
    });

    afterEach(() => {
      MEDIA_OWNER_MODELS[ENTITY] = originalModel;
      jest.restoreAllMocks();
    });

    it("should throw BadRequestException when no file is provided", async () => {
      await expect(
        service.uploadFile(model, ENTITY, COLLECTION, null as unknown as Express.Multer.File, body)
      ).rejects.toThrow(BadRequestException);
    });

    it("should throw InternalServerErrorException when collection config is missing", async () => {
      MEDIA_OWNER_MODELS[ENTITY] = {
        MEDIA: {},
        LARAVEL_TYPE: "x"
      } as unknown as EntityMediaOwnerClass<MediaOwnerModel>;
      await expect(service.uploadFile(model, ENTITY, COLLECTION, file, body)).rejects.toThrow(
        InternalServerErrorException
      );
    });

    it("should run through upload and save media entity", async () => {
      const savedMedia = { uuid: "uuid-test" } as Media;
      jest.spyOn(User, "findOne").mockResolvedValue({ fullName: "foo bar" } as User);
      jest.spyOn(Media.prototype, "save").mockResolvedValue(savedMedia);
      mediaService.uploadFile.mockResolvedValue(undefined);

      const result = await service.uploadFile(model, ENTITY, COLLECTION, file, body);

      expect(mediaService.uploadFile).toHaveBeenCalledWith(file);
      expect(User.findOne).toHaveBeenCalledWith({
        where: { id: entitiesService.userId },
        attributes: ["firstName", "lastName"]
      });
      expect(result).toBe(savedMedia);
    });
  });
});

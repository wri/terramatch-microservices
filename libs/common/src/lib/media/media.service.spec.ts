import { InternalServerErrorException } from "@nestjs/common";
import { User } from "@terramatch-microservices/database/entities/user.entity";
import {
  EntityMediaOwnerClass,
  MEDIA_OWNER_MODELS,
  MediaConfiguration,
  MediaOwnerModel
} from "@terramatch-microservices/database/constants/media-owners";
import { MediaAttributes, MediaService } from "./media.service";
import { ConfigService } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import { createMock } from "@golevelup/ts-jest";
import { TranslatableException } from "../exceptions/translatable.exception";
import { ProjectFactory } from "@terramatch-microservices/database/factories";
import { Project } from "@terramatch-microservices/database/entities";

jest.mock("@aws-sdk/client-s3");
jest.mock("sharp");

describe("MediaService", () => {
  let service: MediaService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [MediaService, { provide: ConfigService, useValue: createMock<ConfigService>() }]
    }).compile();

    service = module.get(MediaService);
  });

  // Helper for accessing private methods without using `any`
  type PrivateMediaService = {
    getMediaType(file: Express.Multer.File): string | undefined;
    validateFile(file: Express.Multer.File, config: MediaConfiguration): boolean | undefined;
    uploadFile(buffer: Buffer<ArrayBufferLike>, path: string, mimetype: string): Promise<void>;
  };

  describe("getMediaType", () => {
    it('should return "documents" for a PDF mimetype', () => {
      const svc = service as unknown as PrivateMediaService;
      const file = { mimetype: "application/pdf" } as Express.Multer.File;
      expect(svc.getMediaType(file)).toBe("documents");
    });

    it('should return "media" for a PNG mimetype', () => {
      const svc = service as unknown as PrivateMediaService;
      const file = { mimetype: "image/png" } as Express.Multer.File;
      expect(svc.getMediaType(file)).toBe("media");
    });
  });

  describe("validateFile", () => {
    const generalConfig: MediaConfiguration = {
      dbCollection: "documents",
      multiple: false,
      validation: "general-documents"
    };

    it("should do nothing if configuration.validation is not set", () => {
      const svc = service as unknown as PrivateMediaService;
      const cfg: MediaConfiguration = { dbCollection: "documents", multiple: true, validation: "documents" };
      const file = { mimetype: "any/type", size: 0 } as Express.Multer.File;
      expect(() => svc.validateFile(file, cfg)).toThrow(TranslatableException);
    });

    it("should throw BadRequestException for unsupported mime type", () => {
      const svc = service as unknown as PrivateMediaService;
      const file = { mimetype: "application/zip", size: 1 } as Express.Multer.File;
      expect(() => svc.validateFile(file, generalConfig)).toThrow(TranslatableException);
    });

    it("should throw and error when file size is above limit", () => {
      const svc = service as unknown as PrivateMediaService;
      const file = { mimetype: "application/pdf", size: 10 * 1024 * 1024 + 1 } as Express.Multer.File;
      expect(() => svc.validateFile(file, generalConfig)).toThrow(TranslatableException);
    });
  });

  describe("createMedia", () => {
    const attributes: MediaAttributes = { isPublic: false, lat: 10, lng: 20 };
    let file: Express.Multer.File;

    beforeEach(() => {
      file = {
        originalname: "test.txt",
        mimetype: "text/plain",
        size: 123,
        buffer: Buffer.from("test text file")
      } as Express.Multer.File;
    });

    afterEach(() => {
      jest.restoreAllMocks();
      MEDIA_OWNER_MODELS["projects"] = Project;
    });

    it("should throw InternalServerErrorException when collection config is missing", async () => {
      MEDIA_OWNER_MODELS["projects"] = {
        MEDIA: {},
        LARAVEL_TYPE: "x"
      } as unknown as EntityMediaOwnerClass<MediaOwnerModel>;
      const model = await ProjectFactory.create();
      await expect(service.createMedia(model, "projects", 1, "file", file, attributes)).rejects.toThrow(
        InternalServerErrorException
      );
    });

    it("should run through upload and save media entity", async () => {
      jest.spyOn(User, "findOne").mockResolvedValue({ fullName: "foo bar" } as User);
      const uploadSpy = jest
        .spyOn(service as unknown as PrivateMediaService, "uploadFile")
        .mockResolvedValue(undefined);

      const model = await ProjectFactory.create();
      const result = await service.createMedia(model, "projects", 1, "file", file, attributes);

      expect(uploadSpy).toHaveBeenCalledWith(file.buffer, `${result.id}/test.txt`, "text/plain");
      expect(User.findOne).toHaveBeenCalledWith({
        where: { id: 1 },
        attributes: ["firstName", "lastName"]
      });
      expect(result.collectionName).toBe("file");
      expect(result.fileName).toBe("test.txt");
      expect(result.modelType).toBe(Project.LARAVEL_TYPE);
      expect(result.modelId).toBe(model.id);
      expect(result.createdBy).toBe(1);
    });
  });
});

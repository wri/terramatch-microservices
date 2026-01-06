import { BadRequestException, InternalServerErrorException } from "@nestjs/common";
import { FileUploadService } from "./file-upload.service";
import { MediaService } from "@terramatch-microservices/common/media/media.service";
import { EntitiesService } from "../entities/entities.service";
import { User } from "@terramatch-microservices/database/entities/user.entity";
import {
  EntityMediaOwnerClass,
  MEDIA_OWNER_MODELS,
  MediaConfiguration,
  MediaOwnerModel,
  MediaOwnerType,
  ValidationKey
} from "@terramatch-microservices/database/constants/media-owners";
import { MediaRequestAttributes } from "../entities/dto/media-request.dto";
import { TranslatableException } from "@terramatch-microservices/common/exceptions/translatable.exception";
import { Media } from "@terramatch-microservices/database/entities";
import { Readable } from "stream";
import path from "path";

jest.mock("sharp", () => {
  return jest.fn(() => ({
    rotate: jest.fn().mockReturnThis(),
    keepExif: jest.fn().mockReturnThis(),
    toBuffer: jest.fn().mockResolvedValue(Buffer.from("mocked-image")),
    resize: jest.fn().mockReturnThis()
  }));
});

import sharp from "sharp";

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

  describe("fetchDataFromUrlAsMulterFile", () => {
    const mockFetch = jest.fn();

    beforeAll(() => {
      global.fetch = mockFetch;
    });

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it("should fetch data from url as multer file", async () => {
      const url = "https://example.com/image.png";
      const buffer = Buffer.from("fake-image-data");

      mockFetch.mockResolvedValue({
        ok: true,
        statusText: "OK",
        headers: {
          get: (key: string) => {
            if (key === "content-type") return "image/png";
            if (key === "content-length") return buffer.length.toString();
            return null;
          }
        },
        arrayBuffer: async () => buffer
      });

      const result = await service.fetchDataFromUrlAsMulterFile(url);

      expect(result).toEqual(
        expect.objectContaining({
          fieldname: "uploadFile",
          originalname: "image.png",
          mimetype: "image/png",
          size: buffer.length,
          buffer
        })
      );

      expect(result.stream).toBeInstanceOf(Readable);
      expect(result.filename).toBe(path.basename(new URL(url).pathname));
    });

    it("should throw BadRequestException if fetch fails", async () => {
      const url = "https://example.com/image.png";

      mockFetch.mockRejectedValue(new Error("Network error"));

      await expect(service.fetchDataFromUrlAsMulterFile(url)).rejects.toThrow(
        new BadRequestException(`Failed to download file from URL ${url}: Network error`)
      );
    });
    it("should throw BadRequestException if response is not ok", async () => {
      const url = "https://example.com/image.png";

      mockFetch.mockResolvedValue({
        ok: false,
        statusText: "404 Not Found"
      });

      await expect(service.fetchDataFromUrlAsMulterFile(url)).rejects.toThrow(
        new BadRequestException(`Failed to download file from URL ${url}: 404 Not Found`)
      );
    });

    it("should throw BadRequestException for invalid mime type", async () => {
      const url = "https://example.com/file.txt";
      const buffer = Buffer.from("text-data");

      mockFetch.mockResolvedValue({
        ok: true,
        statusText: "OK",
        headers: {
          get: (key: string) => {
            if (key === "content-type") return "text/plain";
            return null;
          }
        },
        arrayBuffer: async () => buffer
      });

      await expect(service.fetchDataFromUrlAsMulterFile(url)).rejects.toThrow(
        new BadRequestException("Invalid file type")
      );
    });
  });

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

  describe("validateFile", () => {
    const generalConfig: MediaConfiguration = { multiple: false, validation: "general-documents" };

    it("should return false if configuration.validation is not set", () => {
      const svc = service as unknown as PrivateFileUploadService;
      const cfg: MediaConfiguration = { multiple: true, validation: null as unknown as ValidationKey };
      const file = { mimetype: "any/type", size: 0 } as Express.Multer.File;
      expect(svc.validateFile(file, cfg)).toBe(false);
    });

    it("should do nothing if configuration.validation is not set", () => {
      const svc = service as unknown as PrivateFileUploadService;
      const cfg: MediaConfiguration = { multiple: true, validation: "documents" };
      const file = { mimetype: "any/type", size: 0 } as Express.Multer.File;
      expect(() => svc.validateFile(file, cfg)).toThrow(TranslatableException);
    });

    it("should throw BadRequestException for unsupported mime type", () => {
      const svc = service as unknown as PrivateFileUploadService;
      const file = { mimetype: "application/zip", size: 1 } as Express.Multer.File;
      expect(() => svc.validateFile(file, generalConfig)).toThrow(TranslatableException);
    });

    it("should throw and error when file size is above limit", () => {
      const svc = service as unknown as PrivateFileUploadService;
      const file = { mimetype: "application/pdf", size: 10 * 1024 * 1024 + 1 } as Express.Multer.File;
      expect(() => svc.validateFile(file, generalConfig)).toThrow(TranslatableException);
    });
  });

  describe("uploadFile", () => {
    const COLLECTION = "uploadCollection";
    const ENTITY: MediaOwnerType = "projects";
    const model = { id: 7 } as MediaOwnerModel;
    const attributes: MediaRequestAttributes = { isPublic: false, lat: 10, lng: 20 };
    let originalModel: EntityMediaOwnerClass<MediaOwnerModel>;
    let file: Express.Multer.File;

    beforeEach(() => {
      originalModel = MEDIA_OWNER_MODELS[ENTITY];
      const cfg: MediaConfiguration = { dbCollection: COLLECTION, multiple: false, validation: "documents" };
      MEDIA_OWNER_MODELS[ENTITY] = {
        MEDIA: { [COLLECTION]: cfg },
        LARAVEL_TYPE: "laravel"
      } as unknown as EntityMediaOwnerClass<MediaOwnerModel>;
      file = {
        originalname: "test.txt",
        mimetype: "text/plain",
        size: 123,
        buffer: Buffer.from("test text file")
      } as Express.Multer.File;
    });

    afterEach(() => {
      MEDIA_OWNER_MODELS[ENTITY] = originalModel;
      jest.restoreAllMocks();
    });

    it("should throw BadRequestException when no file is provided", async () => {
      await expect(
        service.uploadFile(model, ENTITY, COLLECTION, null as unknown as Express.Multer.File, attributes)
      ).rejects.toThrow(BadRequestException);
    });

    it("should throw InternalServerErrorException when collection config is missing", async () => {
      MEDIA_OWNER_MODELS[ENTITY] = {
        MEDIA: {},
        LARAVEL_TYPE: "x"
      } as unknown as EntityMediaOwnerClass<MediaOwnerModel>;
      await expect(service.uploadFile(model, ENTITY, COLLECTION, file, attributes)).rejects.toThrow(
        InternalServerErrorException
      );
    });

    it("should run through upload and save media entity", async () => {
      jest.spyOn(User, "findOne").mockResolvedValue({ fullName: "foo bar" } as User);
      mediaService.uploadFile.mockResolvedValue(undefined);

      const result = await service.uploadFile(model, ENTITY, COLLECTION, file, attributes);

      expect(mediaService.uploadFile).toHaveBeenCalledWith(file.buffer, `${result.id}/test.txt`, "text/plain");
      expect(User.findOne).toHaveBeenCalledWith({
        where: { id: entitiesService.userId },
        attributes: ["firstName", "lastName"]
      });
      expect(result.collectionName).toBe(COLLECTION);
      expect(result.fileName).toBe("test.txt");
      expect(result.modelType).toBe("laravel");
      expect(result.modelId).toBe(model.id);
      expect(result.createdBy).toBe(entitiesService.userId);
    });

    it("should create thumbnail if file is an image", async () => {
      const buffer = Buffer.from("mocked-image");
      const file = {
        originalname: "test.png",
        mimetype: "image/png",
        size: 123,
        buffer: buffer
      } as Express.Multer.File;
      const result = await service.uploadFile(model, "sites", "photos", file, attributes);
      expect(mediaService.uploadFile).toHaveBeenCalledWith(file.buffer, `${result.id}/test.png`, "image/png");
      expect(mediaService.uploadFile).toHaveBeenCalledWith(
        file.buffer,
        `${result.id}/conversions/test-thumbnail.png`,
        "image/png"
      );
      expect(result.generatedConversions).toEqual({ thumbnail: true });
      expect(result.customProperties).toEqual({ custom_headers: { ACL: "public-read" }, thumbnailExtension: ".png" });
    });

    it("should throw an error when creating thumbnail fails", async () => {
      (sharp as unknown as jest.Mock).mockImplementationOnce(() => {
        throw new Error("sharp failed");
      });

      const buffer = Buffer.from("mocked-image");
      const file = {
        originalname: "test.png",
        mimetype: "image/png",
        size: 123,
        buffer: buffer
      } as Express.Multer.File;

      await expect(service.uploadFile(model, "sites", "photos", file, attributes)).rejects.toThrow(Error);
    });
  });

  describe("transaction", () => {
    it("should commit a transaction on success", async () => {
      const commit = jest.fn();
      const mockTransaction = { commit, rollback: jest.fn() };
      // @ts-expect-error incomplete mock
      jest.spyOn(Media.sequelize, "transaction").mockResolvedValue(mockTransaction);
      const result = await service.transaction(async () => "success");
      expect(result).toBe("success");
      expect(commit).toHaveBeenCalled();
    });
  });
});

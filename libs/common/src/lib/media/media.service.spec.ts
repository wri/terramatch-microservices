/* eslint-disable @typescript-eslint/no-explicit-any */
import { User } from "@terramatch-microservices/database/entities/user.entity";
import { mediaConfiguration, MediaConfiguration } from "@terramatch-microservices/database/constants/media-owners";
import { MediaService } from "./media.service";
import { ConfigService } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import { createMock, PartialFuncReturn } from "@golevelup/ts-jest";
import { MediaFactory, ProjectFactory, SiteFactory, UserFactory } from "@terramatch-microservices/database/factories";
import { Media, Project, Site } from "@terramatch-microservices/database/entities";
import { faker } from "@faker-js/faker/.";
import { CopyObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";

jest.mock("@aws-sdk/client-s3");

jest.mock("sharp", () => {
  const sharp = {
    rotate: () => sharp,
    keepExif: () => sharp,
    resize: () => sharp,
    toBuffer: () => Promise.resolve(Buffer.from("test file"))
  };
  return {
    __esModule: true,
    default: () => sharp
  };
});

jest.mock("@terramatch-microservices/database/constants/media-owners", () => {
  const actual = jest.requireActual("@terramatch-microservices/database/constants/media-owners");
  return { ...actual, mediaConfiguration: jest.fn((): MediaConfiguration | undefined => undefined) };
});

const mockConfiguration = (config: MediaConfiguration) => {
  (mediaConfiguration as jest.Mock).mockReturnValue(config);
};

const createTestFile = (mimetype = "text/plain", ext = "txt", size = 123) =>
  ({
    originalname: faker.system.commonFileName(ext),
    mimetype,
    size,
    buffer: Buffer.from("test text file")
  } as Express.Multer.File);

describe("MediaService", () => {
  let service: MediaService;
  let creator: User;

  beforeAll(async () => {
    creator = await UserFactory.create();
  });

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        MediaService,
        {
          provide: ConfigService,
          useValue: createMock<ConfigService>({
            get: (key: string): PartialFuncReturn<unknown> => {
              if (key === "AWS_ENDPOINT") return "https://aws.endpoint";
              if (key === "AWS_BUCKET") return "test-bucket";
              return "";
            }
          })
        }
      ]
    }).compile();

    service = module.get(MediaService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  describe("getUrl", () => {
    it("returns a download URL", async () => {
      const media = await MediaFactory.forNursery.create();
      const url = service.getUrl(media);
      expect(url).toBe(`https://aws.endpoint/test-bucket/${media.id}/${media.fileName}`);
    });

    it("returns a thumbnail download URL", async () => {
      const media = await MediaFactory.forNursery.create({ generatedConversions: { thumbnail: true } });
      let url = service.getUrl(media, "thumbnail");
      expect(url).toBe(`https://aws.endpoint/test-bucket/${media.id}/${media.fileName.split(".")[0]}-thumbnail.jpg`);

      media.customProperties = { thumbnailExtension: ".xyz" };
      url = service.getUrl(media, "thumbnail");
      expect(url).toBe(`https://aws.endpoint/test-bucket/${media.id}/${media.fileName.split(".")[0]}-thumbnail.xyz`);
    });
  });

  describe("createMedia", () => {
    it("should throw when collection config is missing", async () => {
      await expect(service.createMedia(new Project(), "projects", creator.id, "foo", createTestFile())).rejects.toThrow(
        "Configuration for collection foo not found"
      );
    });

    it("should throw for unsupported mime type", async () => {
      mockConfiguration({ dbCollection: "documents", multiple: false, validation: "general-documents" });
      const file = { mimetype: "application/zip", size: 1 } as Express.Multer.File;
      await expect(service.createMedia(new Project(), "projects", creator.id, "documents", file)).rejects.toThrow(
        "Invalid file type: application/zip"
      );
    });

    it("should throw when file size is above limit", async () => {
      mockConfiguration({ dbCollection: "documents", multiple: false, validation: "general-documents" });
      const file = createTestFile("application/pdf", "pdf", 10 * 1024 * 1024);
      await expect(service.createMedia(new Project(), "projects", creator.id, "documents", file)).rejects.toThrow(
        "File size must be less than 5MB"
      );
    });

    it("should set a valid media type", async () => {
      mockConfiguration({ dbCollection: "test", multiple: false, validation: "general-documents" });
      let file = createTestFile("application/pdf", "pdf");
      const project = await ProjectFactory.create();
      let media = await service.createMedia(project, "projects", creator.id, "test", file);
      expect(media.fileType).toBe("documents");

      file = createTestFile("image/png", "png");
      media = await service.createMedia(project, "projects", creator.id, "test", file);
      expect(media.fileType).toBe("media");

      file = createTestFile("video/mp4", "mp4");
      media = await service.createMedia(project, "projects", creator.id, "test", file);
      expect(media.fileType).toBe("media");

      file = createTestFile();
      media = await service.createMedia(project, "projects", creator.id, "test", file);
      expect(media.fileType).toBe("documents");
    });

    it("should upload media", async () => {
      const uploadSpy = jest.spyOn((service as any).s3, "send");
      const model = await ProjectFactory.create();
      const file = createTestFile();
      mockConfiguration(Project.MEDIA.file);
      const result = await service.createMedia(model, "projects", creator.id, "file", file);

      expect(uploadSpy).toHaveBeenCalledWith(expect.any(PutObjectCommand));
      expect(result.collectionName).toBe("file");
      expect(result.fileName).toBe(file.originalname);
      expect(result.modelType).toBe(Project.LARAVEL_TYPE);
      expect(result.modelId).toBe(model.id);
      expect(result.createdBy).toBe(creator.id);
    });

    it("should generate thumbnails", async () => {
      const uploadSpy = jest.spyOn((service as any).s3, "send");
      const model = await ProjectFactory.create();
      const file = createTestFile("image/jpeg", "jpg");
      mockConfiguration(Project.MEDIA.photos);
      const result = await service.createMedia(model, "projects", creator.id, "photos", file);

      expect(uploadSpy).toHaveBeenCalledTimes(2);
      expect(result.generatedConversions).toStrictEqual({ thumbnail: true });
      expect(result.customProperties).toMatchObject({ thumbnailExtension: ".jpg" });
    });

    it("should not create media if there's an error", async () => {
      jest.spyOn((service as any).s3, "send").mockRejectedValueOnce(new Error("test error"));
      const model = await ProjectFactory.create();
      const file = createTestFile("image/jpeg", "jpg");
      mockConfiguration(Project.MEDIA.photos);
      const mediaCount = await Media.count({ paranoid: false });
      await expect(service.createMedia(model, "projects", creator.id, "photos", file)).rejects.toThrow("test error");
      expect(await Media.count({ paranoid: false })).toBe(mediaCount);
    });
  });

  describe("duplicateMedia", () => {
    it("should create a duplicate with a new model", async () => {
      const project = await ProjectFactory.create();
      const site = await SiteFactory.create();
      const file = createTestFile();
      mockConfiguration(Project.MEDIA.file);
      const media = await service.createMedia(project, "projects", creator.id, "file", file);

      const copySpy = jest.spyOn((service as any).s3, "send");
      const duplicate = await service.duplicateMedia(media, site);

      expect(copySpy).toHaveBeenCalledWith(expect.any(CopyObjectCommand));
      expect(duplicate.collectionName).toBe(media.collectionName);
      expect(duplicate.modelType).toBe(Site.LARAVEL_TYPE);
      expect(duplicate.modelId).toBe(site.id);
    });

    it("copies conversions", async () => {
      const project = await ProjectFactory.create();
      const site = await SiteFactory.create();
      const file = createTestFile("image/jpeg", "jpg");
      mockConfiguration(Project.MEDIA.photos);
      const media = await service.createMedia(project, "projects", creator.id, "photos", file);

      const copySpy = jest.spyOn((service as any).s3, "send");
      const duplicate = await service.duplicateMedia(media, site);

      expect(copySpy).toHaveBeenCalledWith(expect.any(CopyObjectCommand));
      expect(duplicate.collectionName).toBe(media.collectionName);
      expect(duplicate.modelType).toBe(Site.LARAVEL_TYPE);
      expect(duplicate.modelId).toBe(site.id);
      expect(duplicate.generatedConversions).toStrictEqual(media.generatedConversions);
    });
  });
});

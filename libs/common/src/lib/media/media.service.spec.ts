/* eslint-disable @typescript-eslint/no-explicit-any */
import { User } from "@terramatch-microservices/database/entities/user.entity";
import { mediaConfiguration, MediaConfiguration } from "@terramatch-microservices/database/constants/media-owners";
import { MediaService } from "./media.service";
import { ConfigService } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import { createMock, DeepMocked, PartialFuncReturn } from "@golevelup/ts-jest";
import { MediaFactory, ProjectFactory, SiteFactory, UserFactory } from "@terramatch-microservices/database/factories";
import { Media, Project, Site } from "@terramatch-microservices/database/entities";
import { faker } from "@faker-js/faker/.";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { Op } from "sequelize";
import { FileService } from "../file/file.service";
import { MediaUpdateBody } from "../dto/media-update.dto";

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
  let fileService: DeepMocked<FileService>;
  let creator: User;

  beforeAll(async () => {
    creator = await UserFactory.create();
  });

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        MediaService,
        { provide: FileService, useValue: (fileService = createMock<FileService>()) },
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

  describe("getProjectForModel", () => {
    it("should return the project if the model is a project", async () => {
      const model = await ProjectFactory.create();
      const project = await service.getProjectForModel(model);
      expect(project).not.toBeNull();
    });

    it("should return the project if the model is not a Project", async () => {
      const project = await ProjectFactory.create();
      const model = await SiteFactory.create({ projectId: project.id });
      const returnedProject = await service.getProjectForModel(model);
      expect(returnedProject).not.toBeNull();
    });

    it("should throw an error if the model is not part of a project", async () => {
      const model = await SiteFactory.create();
      model.projectId = undefined as unknown as number;
      await expect(service.getProjectForModel(model)).rejects.toThrow("Media is not part of a project.");
    });
  });

  describe("unsetMediaCoverForProject", () => {
    it("should unset the cover successfully", async () => {
      const project = await ProjectFactory.create();
      const newCover = await MediaFactory.project(project).create();
      const previousCover = await MediaFactory.project(project).create({ isCover: true });
      jest.spyOn(Media, "findAll").mockResolvedValue([previousCover]);
      const updateMedias = await service.unsetMediaCoverForProject(newCover, project);
      expect(updateMedias).toHaveLength(1);
      expect(updateMedias[0]).toBe(previousCover);
    });
  });

  describe("getUrl", () => {
    it("returns a download URL", async () => {
      const media = await MediaFactory.nursery().create();
      const url = service.getUrl(media);
      expect(url).toBe(`https://aws.endpoint/test-bucket/${media.id}/${media.fileName}`);
    });

    it("returns a thumbnail download URL", async () => {
      const media = await MediaFactory.nursery().create({ generatedConversions: { thumbnail: true } });
      let url = service.getUrl(media, "thumbnail");
      expect(url).toBe(
        `https://aws.endpoint/test-bucket/${media.id}/conversions/${media.fileName.split(".")[0]}-thumbnail.jpg`
      );

      media.customProperties = { thumbnailExtension: ".xyz" };
      url = service.getUrl(media, "thumbnail");
      expect(url).toBe(
        `https://aws.endpoint/test-bucket/${media.id}/conversions/${media.fileName.split(".")[0]}-thumbnail.xyz`
      );
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
      const model = await ProjectFactory.create();
      const file = createTestFile();
      mockConfiguration(Project.MEDIA.file);
      const result = await service.createMedia(model, "projects", creator.id, "file", file);

      expect(fileService.uploadFile).toHaveBeenCalledWith(
        file.buffer,
        "test-bucket",
        `${result.id}/${file.originalname}`,
        file.mimetype
      );
      expect(result.collectionName).toBe("file");
      expect(result.fileName).toBe(file.originalname);
      expect(result.modelType).toBe(Project.LARAVEL_TYPE);
      expect(result.modelId).toBe(model.id);
      expect(result.createdBy).toBe(creator.id);
    });

    it("should generate thumbnails", async () => {
      const model = await ProjectFactory.create();
      const file = createTestFile("image/jpeg", "jpg");
      mockConfiguration(Project.MEDIA.photos);
      const result = await service.createMedia(model, "projects", creator.id, "photos", file);

      expect(fileService.uploadFile).toHaveBeenCalledTimes(2);
      expect(fileService.uploadFile).toHaveBeenNthCalledWith(
        1,
        expect.any(Buffer),
        "test-bucket",
        `${result.id}/${file.originalname}`,
        file.mimetype
      );
      const filename = file.originalname.split(".")[0];
      expect(fileService.uploadFile).toHaveBeenNthCalledWith(
        2,
        expect.any(Buffer),
        "test-bucket",
        `${result.id}/conversions/${filename}-thumbnail.jpg`,
        file.mimetype
      );
      expect(result.generatedConversions).toStrictEqual({ thumbnail: true });
      expect(result.customProperties).toMatchObject({ thumbnailExtension: ".jpg" });
    });

    it("should not create media if there's an error", async () => {
      fileService.uploadFile.mockRejectedValueOnce(new Error("test error"));
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

      const duplicate = await service.duplicateMedia(media, site);

      expect(fileService.copyRemoteFile).toHaveBeenCalledWith(
        "test-bucket",
        `${media.id}/${media.fileName}`,
        `${duplicate.id}/${duplicate.fileName}`,
        duplicate.mimeType ?? undefined
      );
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

      const duplicate = await service.duplicateMedia(media, site);

      expect(fileService.copyRemoteFile).toHaveBeenCalledTimes(2);
      expect(duplicate.collectionName).toBe(media.collectionName);
      expect(duplicate.modelType).toBe(Site.LARAVEL_TYPE);
      expect(duplicate.modelId).toBe(site.id);
      expect(duplicate.generatedConversions).toStrictEqual(media.generatedConversions);
    });

    describe("getMedia", () => {
      it("should return the media successfully", async () => {
        const media = await MediaFactory.project().create();
        jest.spyOn(Media, "findOne").mockResolvedValue(media);
        const returnedMedia = await service.getMedia(media.uuid);
        expect(Media.findOne).toHaveBeenCalledWith({ where: { uuid: media.uuid } });
        expect(returnedMedia).not.toBeNull();
      });

      it("should throw an error if the media is not found", async () => {
        jest.spyOn(Media, "findOne").mockResolvedValue(null);
        await expect(service.getMedia("media-uuid")).rejects.toThrow(NotFoundException);
      });
    });

    describe("getMediaWithUser", () => {
      it("should return media including createdByUser association", async () => {
        const media = await MediaFactory.project().create();
        jest.spyOn(Media, "findOne").mockResolvedValue(media);
        const result = await service.getMediaWithUser(media.uuid);
        expect(Media.findOne).toHaveBeenCalledWith({
          where: { uuid: media.uuid },
          include: [{ association: "createdByUser", attributes: ["firstName", "lastName"] }]
        });
        expect(result).not.toBeNull();
      });

      it("should throw NotFoundException when media is not found", async () => {
        jest.spyOn(Media, "findOne").mockResolvedValue(null);
        await expect(service.getMediaWithUser("unknown-uuid")).rejects.toThrow(NotFoundException);
      });
    });

    describe("getMediaBuffer", () => {
      it("should read the file from S3 and return a buffer", async () => {
        const media = await MediaFactory.project().create();
        const chunks = [Buffer.from("chunk1"), Buffer.from("chunk2")];
        const asyncIterable = {
          [Symbol.asyncIterator]: async function* () {
            for (const chunk of chunks) yield chunk;
          }
        };
        fileService.readRemoteFile.mockResolvedValue(asyncIterable as any);

        const result = await service.getMediaBuffer(media);

        expect(fileService.readRemoteFile).toHaveBeenCalledWith("test-bucket", `${media.id}/${media.fileName}`);
        expect(result).toEqual(Buffer.concat(chunks));
      });
    });

    describe("deleteMedia", () => {
      it("should delete the media successfully", async () => {
        const media = await MediaFactory.project().create();
        media.destroy = jest.fn();
        await service.deleteMedia(media);
        expect(media.destroy).toHaveBeenCalled();
      });
    });

    describe("deleteMediaByUuid", () => {
      it("should delete the media successfully", async () => {
        const media = await MediaFactory.project().create();
        jest.spyOn(Media, "findOne").mockResolvedValue(media);
        jest.spyOn(service, "deleteMedia").mockResolvedValue(media);
        await service.deleteMediaByUuid(media.uuid);
        expect(Media.findOne).toHaveBeenCalledWith({ where: { uuid: media.uuid } });
        expect(service.deleteMedia).toHaveBeenCalledWith(media);
      });

      it("should throw an error if the media is not found", async () => {
        jest.spyOn(Media, "findOne").mockResolvedValue(null);
        await expect(service.deleteMediaByUuid("media-uuid")).rejects.toThrow(NotFoundException);
      });
    });

    describe("getMedias", () => {
      it("should return the medias successfully", async () => {
        const medias = await MediaFactory.project().createMany(3);
        jest.spyOn(Media, "findAll").mockResolvedValue(medias);
        const returnedMedias = await service.getMedias(medias.map(media => media.uuid));
        expect(Media.findAll).toHaveBeenCalledWith({ where: { uuid: { [Op.in]: medias.map(media => media.uuid) } } });
        expect(returnedMedias).toHaveLength(3);
      });
    });

    describe("updateMedia", () => {
      it("updates profileImageScale into customProperties.profile_image_scale", async () => {
        const media = await MediaFactory.project().create({
          customProperties: { existing: "value" }
        });

        const payload = {
          data: {
            type: "media",
            id: media.uuid,
            attributes: {
              profileImageScale: 1.5,
              profileImagePosition: { x: 1.5, y: 1.5 },
              description: "new description"
            }
          }
        } as MediaUpdateBody;

        const updated = await service.updateMedia(media, payload);

        expect(Object.prototype.hasOwnProperty.call(updated, "profileImageScale")).toBe(false);

        expect(updated.customProperties).toEqual(
          expect.objectContaining({
            existing: "value",
            profile_image_scale: 1.5,
            profile_image_position: { x: 1.5, y: 1.5 }
          })
        );
        expect(updated.description).toBe("new description");
      });

      it("sets profile_image_scale to null when profileImageScale is null", async () => {
        const media = await MediaFactory.project().create({
          customProperties: {}
        });

        const payload = {
          data: {
            type: "media",
            id: media.uuid,
            attributes: {
              profileImageScale: null,
              profileImagePosition: { x: 1.5, y: 1.5 }
            }
          }
        } as MediaUpdateBody;

        const updated = await service.updateMedia(media, payload);

        expect(updated.customProperties).toEqual(
          expect.objectContaining({
            profile_image_scale: null,
            profile_image_position: { x: 1.5, y: 1.5 }
          })
        );
      });
    });
  });

  describe("fetchRemoteImage", () => {
    it("throws if the fetch fails", async () => {
      global.fetch = jest.fn(() => Promise.reject(new Error("Fetch failed")));
      await expect(service.fetchRemoteImage("image.jpg")).rejects.toThrow(BadRequestException);
    });

    it("throws if the result is not OK", async () => {
      global.fetch = jest.fn(() => Promise.resolve({ ok: false })) as unknown as typeof fetch;
      await expect(service.fetchRemoteImage("image.jpg")).rejects.toThrow(BadRequestException);
    });

    it("throws if the mime type is not allowed", async () => {
      global.fetch = jest.fn(() =>
        Promise.resolve({
          ok: true,
          arrayBuffer: () => Promise.resolve(new ArrayBuffer()),
          headers: new Headers({ "content-type": "text/csv" })
        })
      ) as unknown as typeof fetch;
      await expect(service.fetchRemoteImage("https://example.com/image.jpg")).rejects.toThrow("Invalid file type");
    });

    it("returns the image as a multer file", async () => {
      global.fetch = jest.fn(() =>
        Promise.resolve({
          ok: true,
          arrayBuffer: () => Promise.resolve(new ArrayBuffer()),
          headers: new Headers({ "content-type": "image/jpeg" })
        })
      ) as unknown as typeof fetch;
      const result = await service.fetchRemoteImage("https://example.com/image.jpg");
      expect(result.originalname).toEqual("image.jpg");
      expect(result.mimetype).toEqual("image/jpeg");
      expect(result.filename).toEqual("image.jpg");
    });
  });
});

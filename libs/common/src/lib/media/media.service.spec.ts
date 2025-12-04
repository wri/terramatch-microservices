import { Test } from "@nestjs/testing";
import { MediaService } from "./media.service";
import { ConfigService } from "@nestjs/config";
import { MediaFactory, ProjectFactory } from "@terramatch-microservices/database/factories";
import { SiteFactory } from "@terramatch-microservices/database/factories";
import { getProjectId } from "@terramatch-microservices/database/constants/entities";
import { Media } from "@terramatch-microservices/database/entities";
import { MediaUpdateBody } from "../dto/media-update.dto";
import { PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { createMock, DeepMocked } from "@golevelup/ts-jest";
import { NotFoundException } from "@nestjs/common";
import { Op } from "sequelize";

jest.mock("@terramatch-microservices/database/constants/entities", () => ({
  getProjectId: jest.fn()
}));

jest.mock("@aws-sdk/client-s3", () => ({
  S3Client: jest.fn().mockImplementation(() => ({
    send: jest.fn()
  })),
  PutObjectCommand: jest.fn(),
  DeleteObjectCommand: jest.fn()
}));

describe("MediaService", () => {
  let service: MediaService;
  let configService: DeepMocked<ConfigService>;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module = await Test.createTestingModule({
      providers: [MediaService, { provide: ConfigService, useValue: (configService = createMock<ConfigService>()) }]
    }).compile();

    service = module.get<MediaService>(MediaService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("getProjectForModel", () => {
    it("should return the project if the model is a project", async () => {
      const model = await ProjectFactory.create();
      (getProjectId as jest.Mock).mockResolvedValue(model.id);
      const project = await service.getProjectForModel(model);
      expect(project).not.toBeNull();
    });

    it("should return the project if the model is not a Project", async () => {
      const project = await ProjectFactory.create();
      const model = await SiteFactory.create({ projectId: project.id });
      (getProjectId as jest.Mock).mockResolvedValue(model.projectId);
      const returnedProject = await service.getProjectForModel(model);
      expect(returnedProject).not.toBeNull();
    });

    it("should throw an error if the model is not part of a project", async () => {
      const model = await SiteFactory.create();
      (getProjectId as jest.Mock).mockResolvedValue(null);
      await expect(service.getProjectForModel(model)).rejects.toThrow("Media is not part of a project.");
    });
  });

  describe("unsetMediaCoverForProject", () => {
    it("should unset the cover successfully", async () => {
      const project = await ProjectFactory.create();
      const newCover = await MediaFactory.forProject.create({ modelId: project.id });
      const previousCover = await MediaFactory.forProject.create({ modelId: project.id, isCover: true });
      jest.spyOn(Media, "findAll").mockResolvedValue([previousCover]);
      const updateMedias = await service.unsetMediaCoverForProject(newCover, project);
      expect(updateMedias).toHaveLength(1);
      expect(updateMedias[0]).toBe(previousCover);
    });
  });

  describe("updateMedia", () => {
    it("should update the media successfully", async () => {
      const media = { update: jest.fn() } as unknown as Media;
      const updatePayload = {
        data: { type: "media", id: "media-uuid", attributes: { isCover: true } }
      } as MediaUpdateBody;
      await service.updateMedia(media, updatePayload);
      expect(media.update).toHaveBeenCalledWith(updatePayload.data.attributes);
    });
  });

  describe("uploadFile", () => {
    it("should upload the file successfully", async () => {
      const buffer = Buffer.from("test");
      const path = "test/path";
      const mimetype = "image/png";
      configService.get.mockImplementation((envName: string) => {
        if (envName === "AWS_BUCKET") return "test-bucket";
        return "";
      });
      await service.uploadFile(buffer, path, mimetype);
      expect(PutObjectCommand).toHaveBeenCalledWith({
        Bucket: "test-bucket",
        Key: path,
        Body: buffer,
        ContentType: mimetype,
        ACL: "public-read"
      });
    });
  });

  describe("getUrl", () => {
    it("should return the url for the media", () => {
      configService.get.mockImplementation((envName: string) => {
        if (envName === "AWS_ENDPOINT") return "https://test-endpoint.com";
        if (envName === "AWS_BUCKET") return "test-bucket";
        return "";
      });
      const media = { id: 1, fileName: "media.png" } as Media;
      const url = service.getUrl(media);
      expect(url).toBe(`https://test-endpoint.com/test-bucket/1/media.png`);
    });

    it("should return the url for the media with a conversion", () => {
      configService.get.mockImplementation((envName: string) => {
        if (envName === "AWS_ENDPOINT") return "https://test-endpoint.com";
        if (envName === "AWS_BUCKET") return "test-bucket";
        return "";
      });
      const media = {
        id: 1,
        fileName: "media.png",
        generatedConversions: { thumbnail: true },
        customProperties: { thumbnailExtension: ".jpg" }
      } as unknown as Media;
      const url = service.getUrl(media, "thumbnail");
      expect(url).toBe(`https://test-endpoint.com/test-bucket/1/conversions/media-thumbnail.jpg`);
    });
  });

  describe("getMedia", () => {
    it("should return the media successfully", async () => {
      const media = await MediaFactory.forProject.create();
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

  describe("deleteMedia", () => {
    it("should delete the media successfully", async () => {
      const media = await MediaFactory.forProject.create();
      media.destroy = jest.fn();
      await service.deleteMedia(media);
      expect(DeleteObjectCommand).toHaveBeenCalled();
      expect(media.destroy).toHaveBeenCalled();
    });
  });

  describe("deleteMediaByUuid", () => {
    it("should delete the media successfully", async () => {
      const media = await MediaFactory.forProject.create();
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
      const medias = await MediaFactory.forProject.createMany(3);
      jest.spyOn(Media, "findAll").mockResolvedValue(medias);
      const returnedMedias = await service.getMedias(medias.map(media => media.uuid));
      expect(Media.findAll).toHaveBeenCalledWith({ where: { uuid: { [Op.in]: medias.map(media => media.uuid) } } });
      expect(returnedMedias).toHaveLength(3);
    });
  });
});

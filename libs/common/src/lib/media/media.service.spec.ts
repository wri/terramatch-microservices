import { Test } from "@nestjs/testing";
import { MediaService } from "./media.service";
import { ConfigService } from "@nestjs/config";
import { MediaFactory, ProjectFactory } from "@terramatch-microservices/database/factories";
import { SiteFactory } from "@terramatch-microservices/database/factories";
import { getProjectId } from "@terramatch-microservices/database/constants/entities";
import { Media } from "@terramatch-microservices/database/entities";
import { MediaUpdateBody } from "../dto/media-update.dto";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { createMock, DeepMocked } from "@golevelup/ts-jest";

jest.mock("@terramatch-microservices/database/constants/entities", () => ({
  getProjectId: jest.fn()
}));

jest.mock("@aws-sdk/client-s3", () => ({
  S3Client: jest.fn().mockImplementation(() => ({
    send: jest.fn()
  })),
  PutObjectCommand: jest.fn()
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
      // @ts-expect-error - mockResolvedValue expects an array of [number, Media[]]
      jest.spyOn(Media, "update").mockResolvedValue([1, [previousCover]]);
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
});

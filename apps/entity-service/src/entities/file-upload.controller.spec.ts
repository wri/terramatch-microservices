import { createMock, DeepMocked } from "@golevelup/ts-jest";
import { FileUploadController } from "./file-upload.controller";
import { FileUploadService } from "../file/file-upload.service";
import { Test } from "@nestjs/testing";
import { EntitiesService } from "./entities.service";
import { PolicyService } from "@terramatch-microservices/common";
import { Project, Media } from "@terramatch-microservices/database/entities";
import { NotFoundException } from "@nestjs/common";
import { MediaCollectionEntityDto } from "./dto/media-collection-entity.dto";
import { FastifyRequest } from "fastify";
import { MediaDto } from "./dto/media.dto";
import { EntityProcessor } from "./processors/entity-processor";
import { ProjectLightDto, ProjectFullDto } from "./dto/project.dto";
import { EntityUpdateData } from "./dto/entity-update.dto";
import { HybridSupportProps } from "@terramatch-microservices/common/dto/hybrid-support.dto";

class StubProcessor extends EntityProcessor<Project, ProjectLightDto, ProjectFullDto, EntityUpdateData> {
  LIGHT_DTO = ProjectLightDto;
  FULL_DTO = ProjectFullDto;
  APPROVAL_STATUSES = [];

  findOne = jest.fn(() => Promise.resolve<Project | null>(null));
  findMany = jest.fn(() => Promise.resolve({ models: [], paginationTotal: 0 }));
  getFullDto = jest.fn(() =>
    Promise.resolve({
      id: "uuid",
      dto: new ProjectFullDto(new Project(), {} as HybridSupportProps<ProjectFullDto, Omit<Project, "application">>)
    })
  );
  getLightDto = jest.fn(() =>
    Promise.resolve({
      id: "uuid",
      dto: new ProjectLightDto(new Project(), {} as HybridSupportProps<ProjectLightDto, Project>)
    })
  );
  delete = jest.fn(() => Promise.resolve());
  update = jest.fn(() => Promise.resolve());
}

describe("FileUploadController", () => {
  let controller: FileUploadController;
  let fileUploadService: DeepMocked<FileUploadService>;
  let entitiesService: DeepMocked<EntitiesService>;
  let policyService: DeepMocked<PolicyService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [FileUploadController],
      providers: [
        { provide: FileUploadService, useValue: (fileUploadService = createMock<FileUploadService>()) },
        { provide: EntitiesService, useValue: (entitiesService = createMock<EntitiesService>()) },
        { provide: PolicyService, useValue: (policyService = createMock<PolicyService>()) }
      ]
    }).compile();

    controller = module.get(FileUploadController);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("uploadFile", () => {
    const params: MediaCollectionEntityDto = {
      collection: "photos",
      entity: "projects",
      uuid: "test-uuid"
    };

    const mockRequest = {
      parts: jest.fn().mockResolvedValue([
        {
          fieldname: "file",
          filename: "test.jpg",
          mimetype: "image/jpeg",
          toBuffer: jest.fn().mockResolvedValue(Buffer.from("test")),
          file: {}
        }
      ])
    } as unknown as FastifyRequest;

    const mockProject = new Project();
    mockProject.id = 1;
    mockProject.uuid = "test-uuid";

    const mockMedia = new Media();
    mockMedia.id = 1;
    mockMedia.uuid = "media-uuid";
    mockMedia.collectionName = "photos";
    mockMedia.name = "test.jpg";
    mockMedia.fileName = "test.jpg";
    mockMedia.mimeType = "image/jpeg";
    mockMedia.size = 4;
    mockMedia.isPublic = true;
    mockMedia.isCover = false;
    mockMedia.createdAt = new Date();
    mockMedia.updatedAt = new Date();
    mockMedia.modelType = "Project";
    mockMedia.modelId = 1;
    mockMedia.lat = 0;
    mockMedia.lng = 0;
    mockMedia.disk = "s3";
    mockMedia.fileType = "media";
    mockMedia.manipulations = [];
    mockMedia.generatedConversions = {};
    mockMedia.customProperties = {};
    mockMedia.responsiveImages = [];
    mockMedia.orderColumn = null;
    mockMedia.description = null;
    mockMedia.photographer = null;
    mockMedia.createdBy = 1;

    const mockMediaDto = new MediaDto(mockMedia, {
      url: "https://test.com/test.jpg",
      thumbUrl: "https://test.com/test-thumb.jpg",
      entityType: "projects",
      entityUuid: "test-uuid"
    });

    it("should throw NotFoundException if model is not found", async () => {
      const processor = new StubProcessor(entitiesService, "projects");
      processor.findOne.mockResolvedValue(null);
      entitiesService.createEntityProcessor.mockReturnValue(processor);

      await expect(controller.uploadFile(params, mockRequest)).rejects.toThrow(NotFoundException);
    });

    it("should authorize access to the model", async () => {
      const processor = new StubProcessor(entitiesService, "projects");
      processor.findOne.mockResolvedValue(mockProject);
      entitiesService.createEntityProcessor.mockReturnValue(processor);

      policyService.authorize.mockRejectedValueOnce(new Error("Unauthorized"));
      await expect(controller.uploadFile(params, mockRequest)).rejects.toThrow("Unauthorized");

      policyService.authorize.mockReset();
      policyService.authorize.mockResolvedValueOnce(undefined);
      await controller.uploadFile(params, mockRequest);
      expect(policyService.authorize).toHaveBeenCalledWith("uploadFiles", mockProject);
    });

    it("should upload file and return MediaDto", async () => {
      const processor = new StubProcessor(entitiesService, "projects");
      processor.findOne.mockResolvedValue(mockProject);
      entitiesService.createEntityProcessor.mockReturnValue(processor);

      policyService.authorize.mockResolvedValue(undefined);
      fileUploadService.uploadFile.mockResolvedValue(mockMediaDto);

      const result = await controller.uploadFile(params, mockRequest);

      expect(fileUploadService.uploadFile).toHaveBeenCalledWith(
        mockProject,
        params.entity,
        params.collection,
        mockRequest
      );
      expect(result).toBe(mockMediaDto);
    });
  });
});

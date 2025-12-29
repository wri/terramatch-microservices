import { ProjectPolygonsController } from "./project-polygons.controller";
import { ProjectPolygonsService } from "./project-polygons.service";
import { ProjectPolygonCreationService } from "./project-polygon-creation.service";
import { createMock, DeepMocked } from "@golevelup/ts-jest";
import { Test } from "@nestjs/testing";
import { PolicyService } from "@terramatch-microservices/common";
import { BadRequestException, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { ProjectPolygon } from "@terramatch-microservices/database/entities";
import { ProjectPolygonFactory, ProjectPitchFactory } from "@terramatch-microservices/database/factories";
import { CreateProjectPolygonJsonApiRequestDto } from "./dto/create-project-polygon-request.dto";
import { ProjectPolygonUploadRequestDto } from "./dto/project-polygon-upload.dto";
import { ProjectPolygonDto } from "./dto/project-polygon.dto";
import { serialize } from "@terramatch-microservices/common/util/testing";
import { Resource } from "@terramatch-microservices/common/util";
import { ProjectPolygonQueryDto } from "./dto/project-polygon-query.dto";

describe("ProjectPolygonsController", () => {
  let controller: ProjectPolygonsController;
  let projectPolygonService: DeepMocked<ProjectPolygonsService>;
  let policyService: DeepMocked<PolicyService>;
  let projectPolygonCreationService: DeepMocked<ProjectPolygonCreationService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [ProjectPolygonsController],
      providers: [
        { provide: ProjectPolygonsService, useValue: (projectPolygonService = createMock<ProjectPolygonsService>()) },
        { provide: PolicyService, useValue: (policyService = createMock<PolicyService>()) },
        {
          provide: ProjectPolygonCreationService,
          useValue: (projectPolygonCreationService = createMock<ProjectPolygonCreationService>())
        }
      ]
    }).compile();

    controller = module.get(ProjectPolygonsController);

    projectPolygonService.buildDto.mockImplementation((projectPolygon, projectPitchUuid) => {
      return Promise.resolve(new ProjectPolygonDto(projectPolygon, projectPitchUuid ?? null));
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("findOne", () => {
    it("should throw UnauthorizedException if the policy does not authorize", async () => {
      policyService.authorize.mockRejectedValue(new UnauthorizedException());
      await expect(controller.findOne({ projectPitchUuid: "test-uuid" })).rejects.toThrow(UnauthorizedException);
    });

    it("should throw BadRequestException when projectPitchUuid is not provided", async () => {
      policyService.authorize.mockResolvedValue(undefined);
      const query: ProjectPolygonQueryDto = {};
      await expect(controller.findOne(query)).rejects.toThrow(BadRequestException);
      await expect(controller.findOne(query)).rejects.toThrow("projectPitchUuid query parameter is required");
    });

    it("should throw NotFoundException when project polygon is not found", async () => {
      policyService.authorize.mockResolvedValue(undefined);
      const projectPitchUuid = "550e8400-e29b-41d4-a716-446655440000";
      projectPolygonService.findByProjectPitchUuid.mockResolvedValue(null);

      await expect(controller.findOne({ projectPitchUuid })).rejects.toThrow(NotFoundException);
      await expect(controller.findOne({ projectPitchUuid })).rejects.toThrow(
        `Project polygon not found for project pitch: ${projectPitchUuid}`
      );
    });

    it("should return a valid project polygon when found", async () => {
      policyService.authorize.mockResolvedValue(undefined);
      const projectPitch = await ProjectPitchFactory.build();
      const projectPolygon = await ProjectPolygonFactory.build({
        entityType: ProjectPolygon.LARAVEL_TYPE_PROJECT_PITCH,
        entityId: projectPitch.id
      });

      projectPolygonService.findByProjectPitchUuid.mockResolvedValue(projectPolygon);

      const result = serialize(await controller.findOne({ projectPitchUuid: projectPitch.uuid }));

      expect(result.data).not.toBeNull();
      const resource = result.data as Resource;
      expect(resource.id).toBe(projectPolygon.uuid);
      expect(resource.type).toBe("projectPolygons");
      expect(policyService.authorize).toHaveBeenCalledWith("read", ProjectPolygon);
    });

    it("should include projectPitchUuid in the response", async () => {
      policyService.authorize.mockResolvedValue(undefined);
      const projectPitch = await ProjectPitchFactory.build();
      const projectPolygon = await ProjectPolygonFactory.build({
        entityType: ProjectPolygon.LARAVEL_TYPE_PROJECT_PITCH,
        entityId: projectPitch.id
      });

      projectPolygonService.findByProjectPitchUuid.mockResolvedValue(projectPolygon);

      const result = serialize(await controller.findOne({ projectPitchUuid: projectPitch.uuid }));

      const resource = result.data as Resource;
      expect(resource.attributes).toHaveProperty("projectPitchUuid", projectPitch.uuid);
    });
  });

  describe("create", () => {
    beforeEach(() => {
      Object.defineProperty(policyService, "userId", {
        value: 1,
        writable: true,
        configurable: true
      });
    });

    it("should throw UnauthorizedException when authorization fails", async () => {
      policyService.authorize.mockRejectedValue(new UnauthorizedException());
      const request = { data: { type: "projectPolygons", attributes: { geometries: [] } } };

      await expect(controller.create(request as CreateProjectPolygonJsonApiRequestDto)).rejects.toThrow(
        UnauthorizedException
      );
    });

    it("should throw UnauthorizedException when userId is null", async () => {
      policyService.authorize.mockResolvedValue(undefined);
      Object.defineProperty(policyService, "userId", {
        value: null,
        writable: true,
        configurable: true
      });
      const request = { data: { type: "projectPolygons", attributes: { geometries: [] } } };

      await expect(controller.create(request as CreateProjectPolygonJsonApiRequestDto)).rejects.toThrow(
        UnauthorizedException
      );
      await expect(controller.create(request as CreateProjectPolygonJsonApiRequestDto)).rejects.toThrow(
        "User must be authenticated"
      );
    });

    it("should throw BadRequestException when geometries array is empty", async () => {
      policyService.authorize.mockResolvedValue(undefined);
      const request = { data: { type: "projectPolygons", attributes: { geometries: [] } } };

      await expect(controller.create(request as CreateProjectPolygonJsonApiRequestDto)).rejects.toThrow(
        BadRequestException
      );
      await expect(controller.create(request as CreateProjectPolygonJsonApiRequestDto)).rejects.toThrow(
        "geometries array is required"
      );
    });

    it("should throw BadRequestException when geometries is null", async () => {
      policyService.authorize.mockResolvedValue(undefined);
      const request = { data: { type: "projectPolygons", attributes: {} } };

      await expect(controller.create(request as CreateProjectPolygonJsonApiRequestDto)).rejects.toThrow(
        BadRequestException
      );
    });

    it("should create project polygons with JSON:API format", async () => {
      policyService.authorize.mockResolvedValue(undefined);
      const projectPitch = await ProjectPitchFactory.build();
      const projectPolygon = await ProjectPolygonFactory.build({
        entityType: ProjectPolygon.LARAVEL_TYPE_PROJECT_PITCH,
        entityId: projectPitch.id
      });

      projectPolygonCreationService.createProjectPolygons.mockResolvedValue([projectPolygon]);
      projectPolygonService.loadProjectPitchAssociation.mockResolvedValue({
        [projectPolygon.entityId]: projectPitch.uuid
      });

      const geometries = [
        {
          type: "FeatureCollection",
          features: [
            {
              type: "Feature",
              geometry: {
                type: "Polygon",
                coordinates: [
                  [
                    [0, 0],
                    [0, 1],
                    [1, 1],
                    [1, 0],
                    [0, 0]
                  ]
                ]
              },
              properties: {
                projectPitchUuid: projectPitch.uuid
              }
            }
          ]
        }
      ];
      const request = { data: { type: "projectPolygons", attributes: { geometries } } };

      const result = serialize(await controller.create(request as CreateProjectPolygonJsonApiRequestDto));

      expect(policyService.authorize).toHaveBeenCalledWith("create", ProjectPolygon);
      expect(projectPolygonCreationService.createProjectPolygons).toHaveBeenCalledWith({ geometries }, 1);
      expect(result.data).toBeDefined();

      if (Array.isArray(result.data)) {
        expect(result.data).toHaveLength(1);
        expect(result.data[0].id).toBe(projectPolygon.uuid);
        expect(result.data[0].type).toBe("projectPolygons");
        expect(result.data[0].attributes).toHaveProperty("projectPitchUuid", projectPitch.uuid);
      }
    });

    it("should create multiple project polygons for different project pitches", async () => {
      policyService.authorize.mockResolvedValue(undefined);
      const projectPitch1 = await ProjectPitchFactory.build();
      const projectPitch2 = await ProjectPitchFactory.build();

      const projectPolygon1 = await ProjectPolygonFactory.build({
        entityType: ProjectPolygon.LARAVEL_TYPE_PROJECT_PITCH,
        entityId: projectPitch1.id
      });
      const projectPolygon2 = await ProjectPolygonFactory.build({
        entityType: ProjectPolygon.LARAVEL_TYPE_PROJECT_PITCH,
        entityId: projectPitch2.id
      });

      projectPolygonCreationService.createProjectPolygons.mockResolvedValue([projectPolygon1, projectPolygon2]);
      projectPolygonService.loadProjectPitchAssociation.mockResolvedValue({
        [projectPolygon1.entityId]: projectPitch1.uuid,
        [projectPolygon2.entityId]: projectPitch2.uuid
      });

      const geometries = [
        {
          type: "FeatureCollection",
          features: [
            {
              type: "Feature",
              geometry: {
                type: "Polygon",
                coordinates: [
                  [
                    [0, 0],
                    [0, 1],
                    [1, 1],
                    [1, 0],
                    [0, 0]
                  ]
                ]
              },
              properties: { projectPitchUuid: projectPitch1.uuid }
            }
          ]
        },
        {
          type: "FeatureCollection",
          features: [
            {
              type: "Feature",
              geometry: {
                type: "Polygon",
                coordinates: [
                  [
                    [2, 2],
                    [2, 3],
                    [3, 3],
                    [3, 2],
                    [2, 2]
                  ]
                ]
              },
              properties: { projectPitchUuid: projectPitch2.uuid }
            }
          ]
        }
      ];

      const request = { data: { type: "projectPolygons", attributes: { geometries } } };

      const result = serialize(await controller.create(request as CreateProjectPolygonJsonApiRequestDto));

      expect(result.data).toBeDefined();
      if (Array.isArray(result.data)) {
        expect(result.data).toHaveLength(2);
        expect(result.data.map(r => r.id).sort()).toEqual([projectPolygon1.uuid, projectPolygon2.uuid].sort());
      }
    });

    it("should load project pitch associations for created polygons", async () => {
      policyService.authorize.mockResolvedValue(undefined);
      const projectPitch = await ProjectPitchFactory.build();
      const projectPolygon = await ProjectPolygonFactory.build({
        entityType: ProjectPolygon.LARAVEL_TYPE_PROJECT_PITCH,
        entityId: projectPitch.id
      });

      projectPolygonCreationService.createProjectPolygons.mockResolvedValue([projectPolygon]);
      projectPolygonService.loadProjectPitchAssociation.mockResolvedValue({
        [projectPolygon.entityId]: projectPitch.uuid
      });

      const geometries = [
        {
          type: "FeatureCollection",
          features: [
            {
              type: "Feature",
              geometry: {
                type: "Polygon",
                coordinates: [
                  [
                    [0, 0],
                    [0, 1],
                    [1, 1],
                    [1, 0],
                    [0, 0]
                  ]
                ]
              },
              properties: { projectPitchUuid: projectPitch.uuid }
            }
          ]
        }
      ];

      const request = { data: { type: "projectPolygons", attributes: { geometries } } };

      await controller.create(request as CreateProjectPolygonJsonApiRequestDto);

      expect(projectPolygonService.loadProjectPitchAssociation).toHaveBeenCalledWith([projectPolygon]);
    });
  });

  describe("uploadFile", () => {
    const createMockFile = (): Express.Multer.File =>
      ({
        originalname: "test.geojson",
        mimetype: "application/geo+json",
        buffer: Buffer.from(JSON.stringify({ type: "FeatureCollection", features: [] }))
      } as Express.Multer.File);

    beforeEach(() => {
      Object.defineProperty(policyService, "userId", {
        value: 1,
        writable: true,
        configurable: true
      });
    });

    it("should throw UnauthorizedException when authorization fails", async () => {
      policyService.authorize.mockRejectedValue(new UnauthorizedException());
      const file = createMockFile();
      const payload = { data: { type: "projectPolygons", attributes: { projectPitchUuid: "pitch-uuid" } } };

      await expect(controller.uploadFile(file, payload as ProjectPolygonUploadRequestDto)).rejects.toThrow(
        UnauthorizedException
      );
    });

    it("should throw UnauthorizedException when userId is null", async () => {
      policyService.authorize.mockResolvedValue(undefined);
      Object.defineProperty(policyService, "userId", {
        value: null,
        writable: true,
        configurable: true
      });
      const file = createMockFile();
      const payload = { data: { type: "projectPolygons", attributes: { projectPitchUuid: "pitch-uuid" } } };

      await expect(controller.uploadFile(file, payload as ProjectPolygonUploadRequestDto)).rejects.toThrow(
        UnauthorizedException
      );
      await expect(controller.uploadFile(file, payload as ProjectPolygonUploadRequestDto)).rejects.toThrow(
        "User must be authenticated"
      );
    });

    it("should throw NotFoundException when project pitch is not found", async () => {
      policyService.authorize.mockResolvedValue(undefined);
      const file = createMockFile();
      const payload = { data: { type: "projectPolygons", attributes: { projectPitchUuid: "non-existent-uuid" } } };

      projectPolygonCreationService.uploadProjectPolygonFromFile.mockRejectedValue(
        new NotFoundException("Project pitch not found: non-existent-uuid")
      );

      await expect(controller.uploadFile(file, payload as ProjectPolygonUploadRequestDto)).rejects.toThrow(
        NotFoundException
      );
      expect(projectPolygonCreationService.uploadProjectPolygonFromFile).toHaveBeenCalledWith(
        file,
        "non-existent-uuid",
        1
      );
    });

    it("should throw BadRequestException when file parsing fails", async () => {
      policyService.authorize.mockResolvedValue(undefined);
      const file = createMockFile();
      const payload = { data: { type: "projectPolygons", attributes: { projectPitchUuid: "pitch-uuid" } } };

      projectPolygonCreationService.uploadProjectPolygonFromFile.mockRejectedValue(
        new BadRequestException("Failed to parse file")
      );

      await expect(controller.uploadFile(file, payload as ProjectPolygonUploadRequestDto)).rejects.toThrow(
        BadRequestException
      );
    });

    it("should successfully upload file and create project polygon", async () => {
      policyService.authorize.mockResolvedValue(undefined);
      const projectPitch = await ProjectPitchFactory.build();
      const projectPolygon = await ProjectPolygonFactory.build({
        entityType: ProjectPolygon.LARAVEL_TYPE_PROJECT_PITCH,
        entityId: projectPitch.id
      });

      const file = createMockFile();
      const payload = { data: { type: "projectPolygons", attributes: { projectPitchUuid: projectPitch.uuid } } };

      projectPolygonCreationService.uploadProjectPolygonFromFile.mockResolvedValue(projectPolygon);

      const result = serialize(await controller.uploadFile(file, payload as ProjectPolygonUploadRequestDto));

      expect(policyService.authorize).toHaveBeenCalledWith("create", ProjectPolygon);
      expect(projectPolygonCreationService.uploadProjectPolygonFromFile).toHaveBeenCalledWith(
        file,
        projectPitch.uuid,
        1
      );
      expect(projectPolygonService.buildDto).toHaveBeenCalledWith(projectPolygon, projectPitch.uuid);
      expect(result.data).toBeDefined();

      const resource = result.data as Resource;
      expect(resource.id).toBe(projectPolygon.uuid);
      expect(resource.type).toBe("projectPolygons");
      expect(resource.attributes).toHaveProperty("projectPitchUuid", projectPitch.uuid);
    });

    it("should handle service errors and propagate them", async () => {
      policyService.authorize.mockResolvedValue(undefined);
      const file = createMockFile();
      const payload = { data: { type: "projectPolygons", attributes: { projectPitchUuid: "pitch-uuid" } } };

      projectPolygonCreationService.uploadProjectPolygonFromFile.mockRejectedValue(
        new BadRequestException("Geometry transformation failed")
      );

      await expect(controller.uploadFile(file, payload as ProjectPolygonUploadRequestDto)).rejects.toThrow(
        BadRequestException
      );
      await expect(controller.uploadFile(file, payload as ProjectPolygonUploadRequestDto)).rejects.toThrow(
        "Geometry transformation failed"
      );
    });
  });
});

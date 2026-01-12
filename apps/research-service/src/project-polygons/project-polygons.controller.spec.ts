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
import { UpdateProjectPolygonRequestDto } from "./dto/update-project-polygon-request.dto";
import { ProjectPolygonUploadRequestDto } from "./dto/project-polygon-upload.dto";
import { ProjectPolygonDto } from "./dto/project-polygon.dto";
import { serialize } from "@terramatch-microservices/common/util/testing";
import { Resource } from "@terramatch-microservices/common/util";
import { ProjectPolygonQueryDto } from "./dto/project-polygon-query.dto";
import { FeatureCollection, Polygon } from "geojson";

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
      const pitch = await ProjectPitchFactory.build();
      const projectPolygon = await ProjectPolygonFactory.forPitch(pitch).build();

      projectPolygonService.findByProjectPitchUuid.mockResolvedValue(projectPolygon);

      const result = serialize(await controller.findOne({ projectPitchUuid: pitch.uuid }));

      expect(result.data).not.toBeNull();
      const resource = result.data as Resource;
      expect(resource.id).toBe(`?projectPitchUuid=${pitch.uuid}`);
      expect(resource.type).toBe("projectPolygons");
      expect(resource.attributes).toHaveProperty("uuid", projectPolygon.uuid);
      expect(policyService.authorize).toHaveBeenCalledWith("read", ProjectPolygon);
    });

    it("should include projectPitchUuid in the response", async () => {
      policyService.authorize.mockResolvedValue(undefined);
      const pitch = await ProjectPitchFactory.build();
      const projectPolygon = await ProjectPolygonFactory.forPitch(pitch).build();

      projectPolygonService.findByProjectPitchUuid.mockResolvedValue(projectPolygon);

      const result = serialize(await controller.findOne({ projectPitchUuid: pitch.uuid }));

      const resource = result.data as Resource;
      expect(resource.attributes).toHaveProperty("projectPitchUuid", pitch.uuid);
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
      const pitch = await ProjectPitchFactory.build();
      const projectPolygon = await ProjectPolygonFactory.forPitch(pitch).build();

      projectPolygonCreationService.createProjectPolygons.mockResolvedValue([projectPolygon]);
      projectPolygonService.loadProjectPitchAssociation.mockResolvedValue({
        [projectPolygon.entityId]: pitch.uuid
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
                projectPitchUuid: pitch.uuid
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
        expect(result.data[0].attributes).toHaveProperty("projectPitchUuid", pitch.uuid);
      }
    });

    it("should create multiple project polygons for different project pitches", async () => {
      policyService.authorize.mockResolvedValue(undefined);
      const pitch1 = await ProjectPitchFactory.build();
      const pitch2 = await ProjectPitchFactory.build();

      const projectPolygon1 = await ProjectPolygonFactory.forPitch(pitch1).build();
      const projectPolygon2 = await ProjectPolygonFactory.forPitch(pitch2).build();

      projectPolygonCreationService.createProjectPolygons.mockResolvedValue([projectPolygon1, projectPolygon2]);
      projectPolygonService.loadProjectPitchAssociation.mockResolvedValue({
        [projectPolygon1.entityId]: pitch1.uuid,
        [projectPolygon2.entityId]: pitch2.uuid
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
              properties: { projectPitchUuid: pitch1.uuid }
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
              properties: { projectPitchUuid: pitch2.uuid }
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
      const pitch = await ProjectPitchFactory.build();
      const projectPolygon = await ProjectPolygonFactory.forPitch(pitch).build();

      projectPolygonCreationService.createProjectPolygons.mockResolvedValue([projectPolygon]);
      projectPolygonService.loadProjectPitchAssociation.mockResolvedValue({
        [projectPolygon.entityId]: pitch.uuid
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
              properties: { projectPitchUuid: pitch.uuid }
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
      const pitch = await ProjectPitchFactory.build();
      const projectPolygon = await ProjectPolygonFactory.forPitch(pitch).build();

      const file = createMockFile();
      const payload = { data: { type: "projectPolygons", attributes: { projectPitchUuid: pitch.uuid } } };

      projectPolygonCreationService.uploadProjectPolygonFromFile.mockResolvedValue(projectPolygon);

      const result = serialize(await controller.uploadFile(file, payload as ProjectPolygonUploadRequestDto));

      expect(policyService.authorize).toHaveBeenCalledWith("create", ProjectPolygon);
      expect(projectPolygonCreationService.uploadProjectPolygonFromFile).toHaveBeenCalledWith(file, pitch.uuid, 1);
      expect(projectPolygonService.buildDto).toHaveBeenCalledWith(projectPolygon, pitch.uuid);
      expect(result.data).toBeDefined();

      const resource = result.data as Resource;
      expect(resource.id).toBe(projectPolygon.uuid);
      expect(resource.type).toBe("projectPolygons");
      expect(resource.attributes).toHaveProperty("projectPitchUuid", pitch.uuid);
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

  describe("update", () => {
    beforeEach(() => {
      Object.defineProperty(policyService, "userId", {
        value: 1,
        writable: true,
        configurable: true
      });
    });

    it("should throw BadRequestException when polyUuid in path does not match body", async () => {
      const polyUuid = "poly-uuid-1";
      const request = {
        data: {
          type: "projectPolygons",
          id: "poly-uuid-2",
          attributes: { geometries: [{ type: "FeatureCollection", features: [] }] }
        }
      };

      await expect(controller.update(polyUuid, request as UpdateProjectPolygonRequestDto)).rejects.toThrow(
        BadRequestException
      );
      await expect(controller.update(polyUuid, request as UpdateProjectPolygonRequestDto)).rejects.toThrow(
        "Polygon geometry UUID in path and payload do not match"
      );
    });

    it("should throw NotFoundException when project polygon is not found by polyUuid", async () => {
      const polyUuid = "non-existent-poly-uuid";
      const request = {
        data: {
          type: "projectPolygons",
          id: polyUuid,
          attributes: { geometries: [{ type: "FeatureCollection", features: [] }] }
        }
      };

      projectPolygonService.findByPolyUuid.mockResolvedValue(null);

      await expect(controller.update(polyUuid, request as UpdateProjectPolygonRequestDto)).rejects.toThrow(
        NotFoundException
      );
      await expect(controller.update(polyUuid, request as UpdateProjectPolygonRequestDto)).rejects.toThrow(
        `Project polygon not found for polygon geometry UUID: ${polyUuid}`
      );
    });

    it("should throw UnauthorizedException when authorization fails", async () => {
      const projectPolygon = await ProjectPolygonFactory.forPitch().build();
      const request = {
        data: {
          type: "projectPolygons",
          id: projectPolygon.polyUuid,
          attributes: { geometries: [{ type: "FeatureCollection", features: [] }] }
        }
      };

      projectPolygonService.findByPolyUuid.mockResolvedValue(projectPolygon);
      policyService.authorize.mockRejectedValue(new UnauthorizedException());

      await expect(
        controller.update(projectPolygon.polyUuid, request as UpdateProjectPolygonRequestDto)
      ).rejects.toThrow(UnauthorizedException);
    });

    it("should throw UnauthorizedException when userId is null", async () => {
      const projectPolygon = await ProjectPolygonFactory.forPitch().build();
      const request = {
        data: {
          type: "projectPolygons",
          id: projectPolygon.polyUuid,
          attributes: { geometries: [{ type: "FeatureCollection", features: [] }] }
        }
      };

      projectPolygonService.findByPolyUuid.mockResolvedValue(projectPolygon);
      policyService.authorize.mockResolvedValue(undefined);
      Object.defineProperty(policyService, "userId", {
        value: null,
        writable: true,
        configurable: true
      });

      await expect(
        controller.update(projectPolygon.polyUuid, request as UpdateProjectPolygonRequestDto)
      ).rejects.toThrow(UnauthorizedException);
      await expect(
        controller.update(projectPolygon.polyUuid, request as UpdateProjectPolygonRequestDto)
      ).rejects.toThrow("User must be authenticated");
    });

    it("should throw BadRequestException when geometries array is empty", async () => {
      const projectPolygon = await ProjectPolygonFactory.forPitch().build();
      const request = {
        data: {
          type: "projectPolygons",
          id: projectPolygon.polyUuid,
          attributes: { geometries: [] }
        }
      };

      projectPolygonService.findByPolyUuid.mockResolvedValue(projectPolygon);
      policyService.authorize.mockResolvedValue(undefined);

      await expect(
        controller.update(projectPolygon.polyUuid, request as UpdateProjectPolygonRequestDto)
      ).rejects.toThrow(BadRequestException);
      await expect(
        controller.update(projectPolygon.polyUuid, request as UpdateProjectPolygonRequestDto)
      ).rejects.toThrow("geometries array is required");
    });

    it("should successfully update project polygon geometry", async () => {
      const pitch = await ProjectPitchFactory.build();
      const projectPolygon = await ProjectPolygonFactory.forPitch(pitch).build();

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
              properties: {}
            }
          ]
        }
      ];

      const request = {
        data: {
          type: "projectPolygons",
          id: projectPolygon.polyUuid,
          attributes: { geometries }
        }
      };

      projectPolygonService.findByPolyUuid.mockResolvedValue(projectPolygon);
      policyService.authorize.mockResolvedValue(undefined);
      projectPolygonCreationService.updateProjectPolygon.mockResolvedValue(projectPolygon);
      projectPolygonService.loadProjectPitchAssociation.mockResolvedValue({
        [projectPolygon.entityId]: pitch.uuid
      });

      const result = serialize(
        await controller.update(projectPolygon.polyUuid, request as UpdateProjectPolygonRequestDto)
      );

      expect(projectPolygonService.findByPolyUuid).toHaveBeenCalledWith(projectPolygon.polyUuid);
      expect(policyService.authorize).toHaveBeenCalledWith("update", projectPolygon);
      expect(projectPolygonCreationService.updateProjectPolygon).toHaveBeenCalledWith(projectPolygon, geometries, 1);
      expect(result.data).toBeDefined();

      const resource = result.data as Resource;
      expect(resource.id).toBe(projectPolygon.uuid);
      expect(resource.type).toBe("projectPolygons");
      expect(resource.attributes).toHaveProperty("projectPitchUuid", pitch.uuid);
    });

    it("should update metadata on project polygon", async () => {
      const pitch = await ProjectPitchFactory.build();
      const projectPolygon = await ProjectPolygonFactory.forPitch(pitch).build({
        lastModifiedBy: 999
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
              properties: {}
            }
          ]
        }
      ];

      const request = {
        data: {
          type: "projectPolygons",
          id: projectPolygon.polyUuid,
          attributes: { geometries }
        }
      };

      projectPolygonService.findByPolyUuid.mockResolvedValue(projectPolygon);
      policyService.authorize.mockResolvedValue(undefined);
      projectPolygonCreationService.updateProjectPolygon.mockResolvedValue(projectPolygon);
      projectPolygonService.loadProjectPitchAssociation.mockResolvedValue({
        [projectPolygon.entityId]: pitch.uuid
      });

      await controller.update(projectPolygon.polyUuid, request as UpdateProjectPolygonRequestDto);

      expect(projectPolygonCreationService.updateProjectPolygon).toHaveBeenCalledWith(projectPolygon, geometries, 1);
    });
  });

  describe("delete", () => {
    it("should throw NotFoundException when project polygon is not found by polyUuid", async () => {
      const polyUuid = "non-existent-poly-uuid";
      projectPolygonService.findByPolyUuid.mockResolvedValue(null);

      await expect(controller.delete(polyUuid)).rejects.toThrow(NotFoundException);
      await expect(controller.delete(polyUuid)).rejects.toThrow(
        `Project polygon not found for polygon geometry UUID: ${polyUuid}`
      );
    });

    it("should throw UnauthorizedException when authorization fails", async () => {
      const projectPolygon = await ProjectPolygonFactory.forPitch().build();
      projectPolygonService.findByPolyUuid.mockResolvedValue(projectPolygon);
      policyService.authorize.mockRejectedValue(new UnauthorizedException());

      await expect(controller.delete(projectPolygon.polyUuid)).rejects.toThrow(UnauthorizedException);
    });

    it("should call deleteProjectPolygon with the model using polyUuid", async () => {
      const projectPolygon = await ProjectPolygonFactory.forPitch().build();
      projectPolygonService.findByPolyUuid.mockResolvedValue(projectPolygon);
      policyService.authorize.mockResolvedValue(undefined);
      projectPolygonService.deleteProjectPolygon.mockResolvedValue(projectPolygon.uuid);

      const result = serialize(await controller.delete(projectPolygon.polyUuid));

      expect(projectPolygonService.findByPolyUuid).toHaveBeenCalledWith(projectPolygon.polyUuid);
      expect(policyService.authorize).toHaveBeenCalledWith("delete", projectPolygon);
      expect(projectPolygonService.deleteProjectPolygon).toHaveBeenCalledWith(projectPolygon);
      expect(result.meta.resourceType).toBe("projectPolygons");
      expect(result.meta.resourceIds).toStrictEqual([projectPolygon.polyUuid]);
      expect(result.data).toBeUndefined();
    });
  });

  describe("getGeoJson", () => {
    const mockGeometry: Polygon = {
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
    };

    const mockFeatureCollection: FeatureCollection = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          geometry: mockGeometry,
          properties: {
            projectPitchUuid: "project-pitch-uuid"
          }
        }
      ]
    };

    it("should throw UnauthorizedException if the policy does not authorize", async () => {
      policyService.authorize.mockRejectedValue(new UnauthorizedException());
      await expect(controller.getGeoJson({ projectPitchUuid: "test-uuid" })).rejects.toThrow(UnauthorizedException);
    });

    it("should return GeoJSON for a project pitch polygon by projectPitchUuid", async () => {
      policyService.authorize.mockResolvedValue(undefined);
      const projectPitchUuid = "project-pitch-uuid";

      projectPolygonService.getGeoJson.mockResolvedValue(mockFeatureCollection);

      const result = serialize(await controller.getGeoJson({ projectPitchUuid }));

      expect(policyService.authorize).toHaveBeenCalledWith("read", ProjectPolygon);
      expect(projectPolygonService.getGeoJson).toHaveBeenCalledWith({ projectPitchUuid });
      expect(result.data).not.toBeNull();

      const resource = result.data as Resource;
      expect(resource.id).toBe(projectPitchUuid);
      expect(resource.type).toBe("geojsonExports");
      expect(resource.attributes).toHaveProperty("type", "FeatureCollection");
      expect(resource.attributes).toHaveProperty("features");
    });

    it("should return geometry with projectPitchUuid in properties", async () => {
      policyService.authorize.mockResolvedValue(undefined);
      const projectPitchUuid = "project-pitch-uuid";

      projectPolygonService.getGeoJson.mockResolvedValue(mockFeatureCollection);

      const result = serialize(await controller.getGeoJson({ projectPitchUuid }));

      const resource = result.data as Resource;
      const attributes = resource.attributes as unknown as { features: Array<{ properties: unknown }> };
      expect(attributes.features[0].properties).toEqual({
        projectPitchUuid
      });
      expect(attributes.features[0]).toHaveProperty("geometry");
    });

    it("should throw NotFoundException when project pitch is not found", async () => {
      policyService.authorize.mockResolvedValue(undefined);
      projectPolygonService.getGeoJson.mockRejectedValue(
        new NotFoundException("Project pitch not found for uuid: non-existent-pitch-uuid")
      );

      await expect(controller.getGeoJson({ projectPitchUuid: "non-existent-pitch-uuid" })).rejects.toThrow(
        NotFoundException
      );
    });

    it("should throw NotFoundException when project polygon is not found for pitch", async () => {
      policyService.authorize.mockResolvedValue(undefined);
      projectPolygonService.getGeoJson.mockRejectedValue(
        new NotFoundException("Project polygon not found for project pitch: non-existent-pitch-uuid")
      );

      await expect(controller.getGeoJson({ projectPitchUuid: "non-existent-pitch-uuid" })).rejects.toThrow(
        NotFoundException
      );
    });

    it("should throw NotFoundException when polygon geometry is not found", async () => {
      policyService.authorize.mockResolvedValue(undefined);
      projectPolygonService.getGeoJson.mockRejectedValue(
        new NotFoundException("Polygon geometry not found for uuid: polygon-uuid")
      );

      await expect(controller.getGeoJson({ projectPitchUuid: "project-pitch-uuid" })).rejects.toThrow(
        NotFoundException
      );
    });
  });
});

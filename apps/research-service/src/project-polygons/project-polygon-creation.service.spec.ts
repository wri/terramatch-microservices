import { Test, TestingModule } from "@nestjs/testing";
import { ProjectPolygonCreationService } from "./project-polygon-creation.service";
import { PolygonGeometryCreationService } from "../site-polygons/polygon-geometry-creation.service";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { ProjectPolygon, ProjectPitch, PolygonGeometry } from "@terramatch-microservices/database/entities";
import { ProjectPitchFactory, ProjectPolygonFactory } from "@terramatch-microservices/database/factories";
import { CreateProjectPolygonBatchRequestDto } from "./dto/create-project-polygon-request.dto";

describe("ProjectPolygonCreationService", () => {
  let service: ProjectPolygonCreationService;
  let polygonGeometryService: jest.Mocked<PolygonGeometryCreationService>;

  beforeEach(async () => {
    const mockPolygonGeometryService = {
      createGeometriesFromFeatures: jest.fn()
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectPolygonCreationService,
        {
          provide: PolygonGeometryCreationService,
          useValue: mockPolygonGeometryService
        }
      ]
    }).compile();

    service = module.get<ProjectPolygonCreationService>(ProjectPolygonCreationService);
    polygonGeometryService = module.get(PolygonGeometryCreationService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("createProjectPolygons", () => {
    it("should throw BadRequestException when database connection is not available", async () => {
      const originalSequelize = PolygonGeometry.sequelize;
      Object.defineProperty(PolygonGeometry, "sequelize", {
        value: null,
        writable: true,
        configurable: true
      });

      const request: CreateProjectPolygonBatchRequestDto = { geometries: [] };

      await expect(service.createProjectPolygons(request, 1)).rejects.toThrow(BadRequestException);
      await expect(service.createProjectPolygons(request, 1)).rejects.toThrow("Database connection not available");

      Object.defineProperty(PolygonGeometry, "sequelize", {
        value: originalSequelize,
        writable: true,
        configurable: true
      });
    });

    it("should successfully create a project polygon", async () => {
      const userId = 1;
      const projectPitch = await ProjectPitchFactory.build();
      const polygonUuid = crypto.randomUUID();

      const request: CreateProjectPolygonBatchRequestDto = {
        geometries: [
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
        ]
      };

      const mockTransaction = {
        commit: jest.fn(),
        rollback: jest.fn()
      };

      jest.spyOn(PolygonGeometry.sequelize!, "transaction").mockResolvedValue(mockTransaction as never);
      jest.spyOn(ProjectPitch, "findAll").mockResolvedValue([projectPitch]);
      jest.spyOn(ProjectPitch, "findOne").mockResolvedValue(projectPitch);
      jest.spyOn(ProjectPolygon, "findOne").mockResolvedValue(null);
      polygonGeometryService.createGeometriesFromFeatures.mockResolvedValue({
        uuids: [polygonUuid],
        areas: [100]
      });

      const mockProjectPolygon = await ProjectPolygonFactory.build({
        polyUuid: polygonUuid,
        entityType: ProjectPolygon.LARAVEL_TYPE_PROJECT_PITCH,
        entityId: projectPitch.id,
        createdBy: userId,
        lastModifiedBy: userId
      });
      jest.spyOn(ProjectPolygon, "create").mockResolvedValue(mockProjectPolygon);

      const result = await service.createProjectPolygons(request, userId);

      expect(result).toHaveLength(1);
      expect(result[0].entityId).toBe(projectPitch.id);
      expect(result[0].polyUuid).toBe(polygonUuid);
      expect(mockTransaction.commit).toHaveBeenCalled();
      expect(mockTransaction.rollback).not.toHaveBeenCalled();
    });

    it("should rollback transaction on error", async () => {
      const projectPitch = await ProjectPitchFactory.build();

      const request: CreateProjectPolygonBatchRequestDto = {
        geometries: [
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
        ]
      };

      const mockTransaction = {
        commit: jest.fn(),
        rollback: jest.fn()
      };

      jest.spyOn(PolygonGeometry.sequelize!, "transaction").mockResolvedValue(mockTransaction as never);
      jest.spyOn(ProjectPitch, "findAll").mockResolvedValue([projectPitch]);
      jest.spyOn(ProjectPitch, "findOne").mockResolvedValue(projectPitch);
      jest.spyOn(ProjectPolygon, "findOne").mockResolvedValue(null);
      polygonGeometryService.createGeometriesFromFeatures.mockRejectedValue(new Error("Geometry creation failed"));

      await expect(service.createProjectPolygons(request, 1)).rejects.toThrow("Geometry creation failed");
      expect(mockTransaction.rollback).toHaveBeenCalled();
      expect(mockTransaction.commit).not.toHaveBeenCalled();
    });

    it("should throw NotFoundException when project pitch is not found during validation", async () => {
      const request: CreateProjectPolygonBatchRequestDto = {
        geometries: [
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
                properties: { projectPitchUuid: "non-existent-uuid" }
              }
            ]
          }
        ]
      };

      const mockTransaction = {
        commit: jest.fn(),
        rollback: jest.fn()
      };

      jest.spyOn(PolygonGeometry.sequelize!, "transaction").mockResolvedValue(mockTransaction as never);
      jest.spyOn(ProjectPitch, "findAll").mockResolvedValue([]);

      await expect(service.createProjectPolygons(request, 1)).rejects.toThrow(NotFoundException);
      await expect(service.createProjectPolygons(request, 1)).rejects.toThrow(
        "Project pitches not found: non-existent-uuid"
      );
      expect(mockTransaction.rollback).toHaveBeenCalled();
    });

    it("should throw NotFoundException when project pitch is not found during creation", async () => {
      const projectPitch = await ProjectPitchFactory.build();

      const request: CreateProjectPolygonBatchRequestDto = {
        geometries: [
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
        ]
      };

      const mockTransaction = {
        commit: jest.fn(),
        rollback: jest.fn()
      };

      jest.spyOn(PolygonGeometry.sequelize!, "transaction").mockResolvedValue(mockTransaction as never);
      jest.spyOn(ProjectPitch, "findAll").mockResolvedValue([projectPitch]);
      jest.spyOn(ProjectPitch, "findOne").mockResolvedValue(null);

      await expect(service.createProjectPolygons(request, 1)).rejects.toThrow(NotFoundException);
      await expect(service.createProjectPolygons(request, 1)).rejects.toThrow(
        `Project pitch not found: ${projectPitch.uuid}`
      );
      expect(mockTransaction.rollback).toHaveBeenCalled();
    });

    it("should throw BadRequestException when project polygon already exists", async () => {
      const projectPitch = await ProjectPitchFactory.build();
      const existingPolygon = await ProjectPolygonFactory.build({
        entityType: ProjectPolygon.LARAVEL_TYPE_PROJECT_PITCH,
        entityId: projectPitch.id
      });

      const request: CreateProjectPolygonBatchRequestDto = {
        geometries: [
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
        ]
      };

      const mockTransaction = {
        commit: jest.fn(),
        rollback: jest.fn()
      };

      jest.spyOn(PolygonGeometry.sequelize!, "transaction").mockResolvedValue(mockTransaction as never);
      jest.spyOn(ProjectPitch, "findAll").mockResolvedValue([projectPitch]);
      jest.spyOn(ProjectPitch, "findOne").mockResolvedValue(projectPitch);
      jest.spyOn(ProjectPolygon, "findOne").mockResolvedValue(existingPolygon);

      await expect(service.createProjectPolygons(request, 1)).rejects.toThrow(BadRequestException);
      await expect(service.createProjectPolygons(request, 1)).rejects.toThrow(
        `Project polygon already exists for project pitch ${projectPitch.uuid}`
      );
      expect(mockTransaction.rollback).toHaveBeenCalled();
    });

    it("should throw BadRequestException when no valid geometries are created", async () => {
      const projectPitch = await ProjectPitchFactory.build();

      const request: CreateProjectPolygonBatchRequestDto = {
        geometries: [
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
        ]
      };

      const mockTransaction = {
        commit: jest.fn(),
        rollback: jest.fn()
      };

      jest.spyOn(PolygonGeometry.sequelize!, "transaction").mockResolvedValue(mockTransaction as never);
      jest.spyOn(ProjectPitch, "findAll").mockResolvedValue([projectPitch]);
      jest.spyOn(ProjectPitch, "findOne").mockResolvedValue(projectPitch);
      jest.spyOn(ProjectPolygon, "findOne").mockResolvedValue(null);
      polygonGeometryService.createGeometriesFromFeatures.mockResolvedValue({
        uuids: [],
        areas: []
      });

      await expect(service.createProjectPolygons(request, 1)).rejects.toThrow(BadRequestException);
      await expect(service.createProjectPolygons(request, 1)).rejects.toThrow("No valid geometries were created");
      expect(mockTransaction.rollback).toHaveBeenCalled();
    });

    it("should throw BadRequestException when feature has no projectPitchUuid", async () => {
      const request: CreateProjectPolygonBatchRequestDto = {
        geometries: [
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
        ]
      };

      const mockTransaction = {
        commit: jest.fn(),
        rollback: jest.fn()
      };

      jest.spyOn(PolygonGeometry.sequelize!, "transaction").mockResolvedValue(mockTransaction as never);

      await expect(service.createProjectPolygons(request, 1)).rejects.toThrow(BadRequestException);
      await expect(service.createProjectPolygons(request, 1)).rejects.toThrow(
        "All features must have projectPitchUuid in properties"
      );
      expect(mockTransaction.rollback).toHaveBeenCalled();
    });

    it("should handle multiple project pitches in one request", async () => {
      const userId = 1;
      const projectPitch1 = await ProjectPitchFactory.build();
      const projectPitch2 = await ProjectPitchFactory.build();
      const polygonUuid1 = crypto.randomUUID();
      const polygonUuid2 = crypto.randomUUID();

      const request: CreateProjectPolygonBatchRequestDto = {
        geometries: [
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
        ]
      };

      const mockTransaction = {
        commit: jest.fn(),
        rollback: jest.fn()
      };

      jest.spyOn(PolygonGeometry.sequelize!, "transaction").mockResolvedValue(mockTransaction as never);
      jest.spyOn(ProjectPitch, "findAll").mockResolvedValue([projectPitch1, projectPitch2]);
      jest.spyOn(ProjectPitch, "findOne").mockResolvedValueOnce(projectPitch1).mockResolvedValueOnce(projectPitch2);
      jest.spyOn(ProjectPolygon, "findOne").mockResolvedValue(null);
      polygonGeometryService.createGeometriesFromFeatures
        .mockResolvedValueOnce({
          uuids: [polygonUuid1],
          areas: [100]
        })
        .mockResolvedValueOnce({
          uuids: [polygonUuid2],
          areas: [150]
        });

      const mockProjectPolygon1 = await ProjectPolygonFactory.build({
        polyUuid: polygonUuid1,
        entityId: projectPitch1.id
      });
      const mockProjectPolygon2 = await ProjectPolygonFactory.build({
        polyUuid: polygonUuid2,
        entityId: projectPitch2.id
      });
      jest
        .spyOn(ProjectPolygon, "create")
        .mockResolvedValueOnce(mockProjectPolygon1)
        .mockResolvedValueOnce(mockProjectPolygon2);

      const result = await service.createProjectPolygons(request, userId);

      expect(result).toHaveLength(2);
      expect(result[0].entityId).toBe(projectPitch1.id);
      expect(result[1].entityId).toBe(projectPitch2.id);
      expect(mockTransaction.commit).toHaveBeenCalled();
    });

    it("should skip feature collections with null features", async () => {
      const userId = 1;
      const projectPitch = await ProjectPitchFactory.build();
      const polygonUuid = crypto.randomUUID();

      const request: CreateProjectPolygonBatchRequestDto = {
        geometries: [
          {
            type: "FeatureCollection",
            features: null as never
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
        ]
      };

      const mockTransaction = {
        commit: jest.fn(),
        rollback: jest.fn()
      };

      jest.spyOn(PolygonGeometry.sequelize!, "transaction").mockResolvedValue(mockTransaction as never);
      jest.spyOn(ProjectPitch, "findAll").mockResolvedValue([projectPitch]);
      jest.spyOn(ProjectPitch, "findOne").mockResolvedValue(projectPitch);
      jest.spyOn(ProjectPolygon, "findOne").mockResolvedValue(null);
      polygonGeometryService.createGeometriesFromFeatures.mockResolvedValue({
        uuids: [polygonUuid],
        areas: [100]
      });

      const mockProjectPolygon = await ProjectPolygonFactory.build({
        polyUuid: polygonUuid,
        entityId: projectPitch.id
      });
      jest.spyOn(ProjectPolygon, "create").mockResolvedValue(mockProjectPolygon);

      const result = await service.createProjectPolygons(request, userId);

      expect(result).toHaveLength(1);
      expect(mockTransaction.commit).toHaveBeenCalled();
    });

    it("should group multiple features for the same project pitch", async () => {
      const userId = 1;
      const projectPitch = await ProjectPitchFactory.build();
      const polygonUuid = crypto.randomUUID();

      const request: CreateProjectPolygonBatchRequestDto = {
        geometries: [
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
              },
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
                properties: { projectPitchUuid: projectPitch.uuid }
              }
            ]
          }
        ]
      };

      const mockTransaction = {
        commit: jest.fn(),
        rollback: jest.fn()
      };

      jest.spyOn(PolygonGeometry.sequelize!, "transaction").mockResolvedValue(mockTransaction as never);
      jest.spyOn(ProjectPitch, "findAll").mockResolvedValue([projectPitch]);
      jest.spyOn(ProjectPitch, "findOne").mockResolvedValue(projectPitch);
      jest.spyOn(ProjectPolygon, "findOne").mockResolvedValue(null);
      polygonGeometryService.createGeometriesFromFeatures.mockResolvedValue({
        uuids: [polygonUuid],
        areas: [100]
      });

      const mockProjectPolygon = await ProjectPolygonFactory.build({
        polyUuid: polygonUuid,
        entityId: projectPitch.id
      });
      jest.spyOn(ProjectPolygon, "create").mockResolvedValue(mockProjectPolygon);

      const result = await service.createProjectPolygons(request, userId);

      expect(result).toHaveLength(1);
      expect(polygonGeometryService.createGeometriesFromFeatures).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ type: "Polygon" }),
          expect.objectContaining({ type: "Polygon" })
        ]),
        userId,
        mockTransaction
      );
      expect(mockTransaction.commit).toHaveBeenCalled();
    });
  });
});

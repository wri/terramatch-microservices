import { Test, TestingModule } from "@nestjs/testing";
import { ProjectPolygonCreationService } from "./project-polygon-creation.service";
import { PolygonGeometryCreationService } from "../site-polygons/polygon-geometry-creation.service";
import { GeometryFileProcessingService } from "../site-polygons/geometry-file-processing.service";
import { ProjectPolygonGeometryService } from "./project-polygon-geometry.service";
import { ProjectPolygonsService } from "./project-polygons.service";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { ProjectPolygon, ProjectPitch, PolygonGeometry } from "@terramatch-microservices/database/entities";
import { ProjectPitchFactory, ProjectPolygonFactory } from "@terramatch-microservices/database/factories";
import { CreateProjectPolygonBatchRequestDto } from "./dto/create-project-polygon-request.dto";
import { FeatureCollection, Polygon } from "geojson";

describe("ProjectPolygonCreationService", () => {
  let service: ProjectPolygonCreationService;
  let polygonGeometryService: jest.Mocked<PolygonGeometryCreationService>;
  let geometryFileProcessingService: jest.Mocked<GeometryFileProcessingService>;
  let projectPolygonsService: jest.Mocked<ProjectPolygonsService>;

  beforeEach(async () => {
    const mockPolygonGeometryService = {
      createGeometriesFromFeatures: jest.fn()
    };

    const mockGeometryFileProcessingService = {
      parseGeometryFile: jest.fn()
    };

    const mockProjectPolygonsService = {
      deleteProjectPolygonAndGeometry: jest.fn()
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectPolygonCreationService,
        {
          provide: PolygonGeometryCreationService,
          useValue: mockPolygonGeometryService
        },
        {
          provide: GeometryFileProcessingService,
          useValue: mockGeometryFileProcessingService
        },
        {
          provide: ProjectPolygonGeometryService,
          useValue: { transformFeaturesToSinglePolygon: jest.fn() }
        },
        {
          provide: ProjectPolygonsService,
          useValue: mockProjectPolygonsService
        }
      ]
    }).compile();

    service = module.get<ProjectPolygonCreationService>(ProjectPolygonCreationService);
    polygonGeometryService = module.get(PolygonGeometryCreationService);
    geometryFileProcessingService = module.get(GeometryFileProcessingService);
    projectPolygonsService = module.get(ProjectPolygonsService);
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
      const pitch = await ProjectPitchFactory.build();
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
                properties: { projectPitchUuid: pitch.uuid }
              }
            ]
          }
        ]
      };

      const mockTransaction = {
        commit: jest.fn(),
        rollback: jest.fn()
      };

      const sequelize = PolygonGeometry.sequelize;
      if (sequelize == null) throw new Error("Sequelize not available");
      jest.spyOn(sequelize, "transaction").mockResolvedValue(mockTransaction as never);
      jest.spyOn(ProjectPitch, "findAll").mockResolvedValue([pitch]);
      jest.spyOn(ProjectPitch, "findOne").mockResolvedValue(pitch);
      jest.spyOn(ProjectPolygon, "findAll").mockResolvedValue([]);
      polygonGeometryService.createGeometriesFromFeatures.mockResolvedValue({
        uuids: [polygonUuid],
        areas: [100]
      });

      const mockProjectPolygon = await ProjectPolygonFactory.forPitch(pitch).build({
        polyUuid: polygonUuid,
        createdBy: userId,
        lastModifiedBy: userId
      });
      jest.spyOn(ProjectPolygon, "bulkCreate").mockResolvedValue([mockProjectPolygon]);

      const result = await service.createProjectPolygons(request, userId);

      expect(result).toHaveLength(1);
      expect(result[0].entityId).toBe(pitch.id);
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

      const sequelize = PolygonGeometry.sequelize;
      if (sequelize == null) throw new Error("Sequelize not available");
      jest.spyOn(sequelize, "transaction").mockResolvedValue(mockTransaction as never);
      jest.spyOn(ProjectPitch, "findAll").mockResolvedValue([projectPitch]);
      jest.spyOn(ProjectPitch, "findOne").mockResolvedValue(projectPitch);
      jest.spyOn(ProjectPolygon, "findAll").mockResolvedValue([]);
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

      const sequelize = PolygonGeometry.sequelize;
      if (sequelize == null) throw new Error("Sequelize not available");
      jest.spyOn(sequelize, "transaction").mockResolvedValue(mockTransaction as never);
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

      const sequelize = PolygonGeometry.sequelize;
      if (sequelize == null) throw new Error("Sequelize not available");
      jest.spyOn(sequelize, "transaction").mockResolvedValue(mockTransaction as never);
      jest.spyOn(ProjectPitch, "findAll").mockResolvedValue([projectPitch]);
      jest.spyOn(ProjectPitch, "findOne").mockResolvedValue(null);

      await expect(service.createProjectPolygons(request, 1)).rejects.toThrow(NotFoundException);
      await expect(service.createProjectPolygons(request, 1)).rejects.toThrow(
        `Project pitch not found: ${projectPitch.uuid}`
      );
      expect(mockTransaction.rollback).toHaveBeenCalled();
    });

    it("should append new project polygons without deleting existing ones", async () => {
      const userId = 1;
      const pitch = await ProjectPitchFactory.build();
      const existingPolygon = await ProjectPolygonFactory.forPitch(pitch).build();
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
                properties: { projectPitchUuid: pitch.uuid }
              }
            ]
          }
        ]
      };

      const mockTransaction = {
        commit: jest.fn(),
        rollback: jest.fn()
      };

      const sequelize = PolygonGeometry.sequelize;
      if (sequelize == null) throw new Error("Sequelize not available");
      jest.spyOn(sequelize, "transaction").mockResolvedValue(mockTransaction as never);
      jest.spyOn(ProjectPitch, "findAll").mockResolvedValue([pitch]);
      jest.spyOn(ProjectPitch, "findOne").mockResolvedValue(pitch);
      jest.spyOn(ProjectPolygon, "findAll").mockResolvedValue([existingPolygon]);
      polygonGeometryService.createGeometriesFromFeatures.mockResolvedValue({
        uuids: [polygonUuid],
        areas: [100]
      });

      const mockProjectPolygon = await ProjectPolygonFactory.forPitch(pitch).build({
        polyUuid: polygonUuid,
        createdBy: userId,
        lastModifiedBy: userId
      });
      jest.spyOn(ProjectPolygon, "bulkCreate").mockResolvedValue([mockProjectPolygon]);

      const result = await service.createProjectPolygons(request, userId);

      expect(projectPolygonsService.deleteProjectPolygonAndGeometry).not.toHaveBeenCalled();
      expect(result).toHaveLength(1);
      expect(result[0].entityId).toBe(pitch.id);
      expect(result[0].polyUuid).toBe(polygonUuid);
      expect(mockTransaction.commit).toHaveBeenCalled();
      expect(mockTransaction.rollback).not.toHaveBeenCalled();
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

      const sequelize = PolygonGeometry.sequelize;
      if (sequelize == null) throw new Error("Sequelize not available");
      jest.spyOn(sequelize, "transaction").mockResolvedValue(mockTransaction as never);
      jest.spyOn(ProjectPitch, "findAll").mockResolvedValue([projectPitch]);
      jest.spyOn(ProjectPitch, "findOne").mockResolvedValue(projectPitch);
      jest.spyOn(ProjectPolygon, "findAll").mockResolvedValue([]);
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

      const sequelize = PolygonGeometry.sequelize;
      if (sequelize == null) throw new Error("Sequelize not available");
      jest.spyOn(sequelize, "transaction").mockResolvedValue(mockTransaction as never);

      await expect(service.createProjectPolygons(request, 1)).rejects.toThrow(BadRequestException);
      await expect(service.createProjectPolygons(request, 1)).rejects.toThrow(
        "All features must have projectPitchUuid in properties"
      );
      expect(mockTransaction.rollback).toHaveBeenCalled();
    });

    it("should handle multiple project pitches in one request", async () => {
      const userId = 1;
      const pitch1 = await ProjectPitchFactory.build();
      const pitch2 = await ProjectPitchFactory.build();
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
        ]
      };

      const mockTransaction = {
        commit: jest.fn(),
        rollback: jest.fn()
      };

      const sequelize = PolygonGeometry.sequelize;
      if (sequelize == null) throw new Error("Sequelize not available");
      jest.spyOn(sequelize, "transaction").mockResolvedValue(mockTransaction as never);
      jest.spyOn(ProjectPitch, "findAll").mockResolvedValue([pitch1, pitch2]);
      jest.spyOn(ProjectPitch, "findOne").mockResolvedValueOnce(pitch1).mockResolvedValueOnce(pitch2);
      jest.spyOn(ProjectPolygon, "findAll").mockResolvedValue([]);
      polygonGeometryService.createGeometriesFromFeatures
        .mockResolvedValueOnce({
          uuids: [polygonUuid1],
          areas: [100]
        })
        .mockResolvedValueOnce({
          uuids: [polygonUuid2],
          areas: [150]
        });

      const mockProjectPolygon1 = await ProjectPolygonFactory.forPitch(pitch1).build({
        polyUuid: polygonUuid1
      });
      const mockProjectPolygon2 = await ProjectPolygonFactory.forPitch(pitch2).build({
        polyUuid: polygonUuid2
      });
      jest
        .spyOn(ProjectPolygon, "bulkCreate")
        .mockResolvedValueOnce([mockProjectPolygon1])
        .mockResolvedValueOnce([mockProjectPolygon2]);

      const result = await service.createProjectPolygons(request, userId);

      expect(result).toHaveLength(2);
      expect(result[0].entityId).toBe(pitch1.id);
      expect(result[1].entityId).toBe(pitch2.id);
      expect(mockTransaction.commit).toHaveBeenCalled();
    });

    it("should skip feature collections with null features", async () => {
      const userId = 1;
      const pitch = await ProjectPitchFactory.build();
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
                properties: { projectPitchUuid: pitch.uuid }
              }
            ]
          }
        ]
      };

      const mockTransaction = {
        commit: jest.fn(),
        rollback: jest.fn()
      };

      const sequelize = PolygonGeometry.sequelize;
      if (sequelize == null) throw new Error("Sequelize not available");
      jest.spyOn(sequelize, "transaction").mockResolvedValue(mockTransaction as never);
      jest.spyOn(ProjectPitch, "findAll").mockResolvedValue([pitch]);
      jest.spyOn(ProjectPitch, "findOne").mockResolvedValue(pitch);
      jest.spyOn(ProjectPolygon, "findAll").mockResolvedValue([]);
      polygonGeometryService.createGeometriesFromFeatures.mockResolvedValue({
        uuids: [polygonUuid],
        areas: [100]
      });

      const mockProjectPolygon = await ProjectPolygonFactory.forPitch(pitch).build({
        polyUuid: polygonUuid
      });
      jest.spyOn(ProjectPolygon, "bulkCreate").mockResolvedValue([mockProjectPolygon]);

      const result = await service.createProjectPolygons(request, userId);

      expect(result).toHaveLength(1);
      expect(mockTransaction.commit).toHaveBeenCalled();
    });

    it("should create one project polygon record per geometry for the same project pitch", async () => {
      const userId = 1;
      const pitch = await ProjectPitchFactory.build();
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
                properties: { projectPitchUuid: pitch.uuid }
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
                properties: { projectPitchUuid: pitch.uuid }
              }
            ]
          }
        ]
      };

      const mockTransaction = {
        commit: jest.fn(),
        rollback: jest.fn()
      };

      const sequelize = PolygonGeometry.sequelize;
      if (sequelize == null) throw new Error("Sequelize not available");
      jest.spyOn(sequelize, "transaction").mockResolvedValue(mockTransaction as never);
      jest.spyOn(ProjectPitch, "findAll").mockResolvedValue([pitch]);
      jest.spyOn(ProjectPitch, "findOne").mockResolvedValue(pitch);
      jest.spyOn(ProjectPolygon, "findAll").mockResolvedValue([]);
      polygonGeometryService.createGeometriesFromFeatures.mockResolvedValue({
        uuids: [polygonUuid1, polygonUuid2],
        areas: [100, 150]
      });

      const mockProjectPolygon1 = await ProjectPolygonFactory.forPitch(pitch).build({
        polyUuid: polygonUuid1
      });
      const mockProjectPolygon2 = await ProjectPolygonFactory.forPitch(pitch).build({
        polyUuid: polygonUuid2
      });
      jest.spyOn(ProjectPolygon, "bulkCreate").mockResolvedValue([mockProjectPolygon1, mockProjectPolygon2]);

      const result = await service.createProjectPolygons(request, userId);

      expect(result).toHaveLength(2);
      expect(polygonGeometryService.createGeometriesFromFeatures).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ type: "Polygon" }),
          expect.objectContaining({ type: "Polygon" })
        ]),
        userId,
        mockTransaction
      );
      expect(ProjectPolygon.bulkCreate).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ polyUuid: polygonUuid1, entityId: pitch.id }),
          expect.objectContaining({ polyUuid: polygonUuid2, entityId: pitch.id })
        ]),
        { transaction: mockTransaction }
      );
      expect(mockTransaction.commit).toHaveBeenCalled();
    });
  });

  describe("uploadProjectPolygonFromFile", () => {
    const createMockFile = (): Express.Multer.File =>
      ({
        originalname: "test.geojson",
        mimetype: "application/geo+json",
        buffer: Buffer.from(JSON.stringify({ type: "FeatureCollection", features: [] }))
      }) as Express.Multer.File;

    const createFeatureCollection = (): FeatureCollection => ({
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
          } as Polygon,
          properties: {}
        }
      ]
    });

    it("should throw BadRequestException when database connection is not available", async () => {
      const originalSequelize = PolygonGeometry.sequelize;
      Object.defineProperty(PolygonGeometry, "sequelize", {
        value: null,
        writable: true,
        configurable: true
      });

      const file = createMockFile();

      await expect(service.uploadProjectPolygonFromFile(file, "pitch-uuid", 1)).rejects.toThrow(BadRequestException);
      await expect(service.uploadProjectPolygonFromFile(file, "pitch-uuid", 1)).rejects.toThrow(
        "Database connection not available"
      );

      Object.defineProperty(PolygonGeometry, "sequelize", {
        value: originalSequelize,
        writable: true,
        configurable: true
      });
    });

    it("should throw BadRequestException when file parsing fails", async () => {
      const file = createMockFile();
      geometryFileProcessingService.parseGeometryFile.mockRejectedValue(
        new BadRequestException("Failed to parse file")
      );

      await expect(service.uploadProjectPolygonFromFile(file, "pitch-uuid", 1)).rejects.toThrow(BadRequestException);
    });

    it("should throw NotFoundException when project pitch is not found", async () => {
      const file = createMockFile();
      const featureCollection = createFeatureCollection();

      const mockTransaction = {
        commit: jest.fn(),
        rollback: jest.fn()
      };

      const sequelize = PolygonGeometry.sequelize;
      if (sequelize == null) throw new Error("Sequelize not available");
      jest.spyOn(sequelize, "transaction").mockResolvedValue(mockTransaction as never);
      geometryFileProcessingService.parseGeometryFile.mockResolvedValue(featureCollection);
      jest.spyOn(ProjectPitch, "findOne").mockResolvedValue(null);

      await expect(service.uploadProjectPolygonFromFile(file, "non-existent-uuid", 1)).rejects.toThrow(
        NotFoundException
      );
      await expect(service.uploadProjectPolygonFromFile(file, "non-existent-uuid", 1)).rejects.toThrow(
        "Project pitch not found: non-existent-uuid"
      );
      expect(mockTransaction.rollback).toHaveBeenCalled();
    });

    it("should successfully upload file and create project polygon", async () => {
      const userId = 1;
      const pitch = await ProjectPitchFactory.build();
      const file = createMockFile();
      const featureCollection = createFeatureCollection();
      const polygonUuid = crypto.randomUUID();

      const mockTransaction = {
        commit: jest.fn(),
        rollback: jest.fn()
      };

      const sequelize = PolygonGeometry.sequelize;
      if (sequelize == null) throw new Error("Sequelize not available");
      jest.spyOn(sequelize, "transaction").mockResolvedValue(mockTransaction as never);
      geometryFileProcessingService.parseGeometryFile.mockResolvedValue(featureCollection);
      jest.spyOn(ProjectPitch, "findOne").mockResolvedValue(pitch);
      polygonGeometryService.createGeometriesFromFeatures.mockResolvedValue({
        uuids: [polygonUuid],
        areas: [100]
      });

      const mockProjectPolygon = await ProjectPolygonFactory.forPitch(pitch).build({
        polyUuid: polygonUuid,
        createdBy: userId,
        lastModifiedBy: userId
      });
      jest.spyOn(ProjectPolygon, "bulkCreate").mockResolvedValue([mockProjectPolygon]);

      const result = await service.uploadProjectPolygonFromFile(file, pitch.uuid, userId);

      expect(geometryFileProcessingService.parseGeometryFile).toHaveBeenCalledWith(file);
      expect(polygonGeometryService.createGeometriesFromFeatures).toHaveBeenCalledWith(
        [featureCollection.features[0].geometry],
        userId,
        mockTransaction
      );
      expect(ProjectPolygon.bulkCreate).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            polyUuid: polygonUuid,
            entityType: ProjectPitch.LARAVEL_TYPE,
            entityId: pitch.id
          })
        ]),
        { transaction: mockTransaction }
      );
      expect(result[0].entityId).toBe(pitch.id);
      expect(result[0].polyUuid).toBe(polygonUuid);
      expect(mockTransaction.commit).toHaveBeenCalled();
      expect(mockTransaction.rollback).not.toHaveBeenCalled();
    });

    it("should append uploaded polygons without deleting existing ones", async () => {
      const userId = 1;
      const pitch = await ProjectPitchFactory.build();
      const file = createMockFile();
      const featureCollection = createFeatureCollection();
      const polygonUuid = crypto.randomUUID();

      const mockTransaction = {
        commit: jest.fn(),
        rollback: jest.fn()
      };

      const sequelize = PolygonGeometry.sequelize;
      if (sequelize == null) throw new Error("Sequelize not available");
      jest.spyOn(sequelize, "transaction").mockResolvedValue(mockTransaction as never);
      geometryFileProcessingService.parseGeometryFile.mockResolvedValue(featureCollection);
      jest.spyOn(ProjectPitch, "findOne").mockResolvedValue(pitch);
      polygonGeometryService.createGeometriesFromFeatures.mockResolvedValue({
        uuids: [polygonUuid],
        areas: [100]
      });

      const mockProjectPolygon = await ProjectPolygonFactory.forPitch(pitch).build({
        polyUuid: polygonUuid,
        createdBy: userId,
        lastModifiedBy: userId
      });
      jest.spyOn(ProjectPolygon, "bulkCreate").mockResolvedValue([mockProjectPolygon]);

      const result = await service.uploadProjectPolygonFromFile(file, pitch.uuid, userId);

      expect(projectPolygonsService.deleteProjectPolygonAndGeometry).not.toHaveBeenCalled();
      expect(polygonGeometryService.createGeometriesFromFeatures).toHaveBeenCalledWith(
        [featureCollection.features[0].geometry],
        userId,
        mockTransaction
      );
      expect(result[0].entityId).toBe(pitch.id);
      expect(result[0].polyUuid).toBe(polygonUuid);
      expect(mockTransaction.commit).toHaveBeenCalled();
      expect(mockTransaction.rollback).not.toHaveBeenCalled();
    });

    it("should throw BadRequestException when no polygon geometry is created", async () => {
      const projectPitch = await ProjectPitchFactory.build();
      const file = createMockFile();
      const featureCollection = createFeatureCollection();

      const mockTransaction = {
        commit: jest.fn(),
        rollback: jest.fn()
      };

      const sequelize = PolygonGeometry.sequelize;
      if (sequelize == null) throw new Error("Sequelize not available");
      jest.spyOn(sequelize, "transaction").mockResolvedValue(mockTransaction as never);
      geometryFileProcessingService.parseGeometryFile.mockResolvedValue(featureCollection);
      jest.spyOn(ProjectPitch, "findOne").mockResolvedValue(projectPitch);
      polygonGeometryService.createGeometriesFromFeatures.mockResolvedValue({
        uuids: [],
        areas: []
      });

      await expect(service.uploadProjectPolygonFromFile(file, projectPitch.uuid, 1)).rejects.toThrow(
        BadRequestException
      );
      await expect(service.uploadProjectPolygonFromFile(file, projectPitch.uuid, 1)).rejects.toThrow(
        "Failed to create polygon geometry"
      );
      expect(mockTransaction.rollback).toHaveBeenCalled();
    });
  });
});

import { ProjectPolygonsService } from "./project-polygons.service";
import { Test, TestingModule } from "@nestjs/testing";
import { ProjectPolygonFactory, ProjectPitchFactory } from "@terramatch-microservices/database/factories";
import { ProjectPolygon, ProjectPitch } from "@terramatch-microservices/database/entities";
import { InternalServerErrorException } from "@nestjs/common";
import { ProjectPolygonDto } from "./dto/project-polygon.dto";

describe("ProjectPolygonsService", () => {
  let service: ProjectPolygonsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ProjectPolygonsService]
    }).compile();

    service = module.get<ProjectPolygonsService>(ProjectPolygonsService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  describe("findByProjectPitchUuid", () => {
    it("should return null when project pitch is not found", async () => {
      jest.spyOn(ProjectPitch, "findOne").mockResolvedValue(null);
      const result = await service.findByProjectPitchUuid("non-existent-uuid");
      expect(result).toBeNull();
    });

    it("should return null when project polygon is not found", async () => {
      const projectPitch = await ProjectPitchFactory.build();
      jest.spyOn(ProjectPitch, "findOne").mockResolvedValue(projectPitch);
      jest.spyOn(ProjectPolygon, "findOne").mockResolvedValue(null);

      const result = await service.findByProjectPitchUuid(projectPitch.uuid);
      expect(result).toBeNull();
    });

    it("should return project polygon when found", async () => {
      const projectPitch = await ProjectPitchFactory.build();
      const projectPolygon = await ProjectPolygonFactory.build({
        entityType: ProjectPolygon.LARAVEL_TYPE_PROJECT_PITCH,
        entityId: projectPitch.id
      });

      jest.spyOn(ProjectPitch, "findOne").mockResolvedValue(projectPitch);
      jest.spyOn(ProjectPolygon, "findOne").mockResolvedValue(projectPolygon);

      const result = await service.findByProjectPitchUuid(projectPitch.uuid);

      expect(result).not.toBeNull();
      expect(result?.uuid).toBe(projectPolygon.uuid);
      expect(result?.entityId).toBe(projectPitch.id);
      expect(result?.entityType).toBe(ProjectPolygon.LARAVEL_TYPE_PROJECT_PITCH);
    });

    it("should query with correct parameters", async () => {
      const projectPitch = await ProjectPitchFactory.build();
      const projectPitchFindOneSpy = jest.spyOn(ProjectPitch, "findOne").mockResolvedValue(projectPitch);
      const projectPolygonFindOneSpy = jest.spyOn(ProjectPolygon, "findOne").mockResolvedValue(null);

      await service.findByProjectPitchUuid(projectPitch.uuid);

      expect(projectPitchFindOneSpy).toHaveBeenCalledWith({
        where: { uuid: projectPitch.uuid },
        attributes: ["id", "uuid"]
      });

      expect(projectPolygonFindOneSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            entityType: ProjectPolygon.LARAVEL_TYPE_PROJECT_PITCH,
            entityId: projectPitch.id
          }
        })
      );
    });
  });

  describe("loadProjectPitchAssociation", () => {
    it("should return empty object when no project polygons provided", async () => {
      const result = await service.loadProjectPitchAssociation([]);
      expect(result).toEqual({});
    });

    it("should return empty object when no project pitch entities", async () => {
      const projectPolygon = await ProjectPolygonFactory.build({
        entityType: "SomeOtherType",
        entityId: 1
      });

      const result = await service.loadProjectPitchAssociation([projectPolygon]);
      expect(result).toEqual({});
    });

    it("should map project pitch IDs to UUIDs", async () => {
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

      jest.spyOn(ProjectPitch, "findAll").mockResolvedValue([projectPitch1, projectPitch2]);

      const result = await service.loadProjectPitchAssociation([projectPolygon1, projectPolygon2]);

      expect(result).toEqual({
        [projectPitch1.id]: projectPitch1.uuid,
        [projectPitch2.id]: projectPitch2.uuid
      });
    });

    it("should filter out non-project-pitch polygons", async () => {
      const projectPitch = await ProjectPitchFactory.build();
      const projectPolygon = await ProjectPolygonFactory.build({
        entityType: ProjectPolygon.LARAVEL_TYPE_PROJECT_PITCH,
        entityId: projectPitch.id
      });
      const otherPolygon = await ProjectPolygonFactory.build({
        entityType: "SomeOtherType",
        entityId: 999
      });

      const findAllSpy = jest.spyOn(ProjectPitch, "findAll").mockResolvedValue([projectPitch]);

      await service.loadProjectPitchAssociation([projectPolygon, otherPolygon]);

      expect(findAllSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: expect.objectContaining({
              [Symbol.for("in")]: [projectPitch.id]
            })
          })
        })
      );
    });
  });

  describe("buildDto", () => {
    it("should build DTO with provided projectPitchUuid", async () => {
      const projectPitch = await ProjectPitchFactory.build();
      const projectPolygon = await ProjectPolygonFactory.build({
        entityType: ProjectPolygon.LARAVEL_TYPE_PROJECT_PITCH,
        entityId: projectPitch.id
      });

      const dto = await service.buildDto(projectPolygon, projectPitch.uuid);

      expect(dto).toBeInstanceOf(ProjectPolygonDto);
      expect(dto.uuid).toBe(projectPolygon.uuid);
      expect(dto.projectPitchUuid).toBe(projectPitch.uuid);
      expect(dto.polygonUuid).toBe(projectPolygon.polyUuid);
    });

    it("should fetch projectPitchUuid when not provided", async () => {
      const projectPitch = await ProjectPitchFactory.build();
      const projectPolygon = await ProjectPolygonFactory.build({
        entityType: ProjectPolygon.LARAVEL_TYPE_PROJECT_PITCH,
        entityId: projectPitch.id
      });

      jest.spyOn(ProjectPitch, "findByPk").mockResolvedValue(projectPitch);

      const dto = await service.buildDto(projectPolygon);

      expect(dto.projectPitchUuid).toBe(projectPitch.uuid);
    });

    it("should set projectPitchUuid to null when project pitch not found", async () => {
      const projectPolygon = await ProjectPolygonFactory.build({
        entityType: ProjectPolygon.LARAVEL_TYPE_PROJECT_PITCH,
        entityId: 999
      });

      jest.spyOn(ProjectPitch, "findByPk").mockResolvedValue(null);

      const dto = await service.buildDto(projectPolygon);

      expect(dto.projectPitchUuid).toBeNull();
    });

    it("should set projectPitchUuid to null for non-project-pitch entities", async () => {
      const projectPolygon = await ProjectPolygonFactory.build({
        entityType: "SomeOtherType",
        entityId: 1
      });

      const dto = await service.buildDto(projectPolygon);

      expect(dto.projectPitchUuid).toBeNull();
    });
  });

  describe("transaction", () => {
    it("should commit a transaction on success", async () => {
      const commit = jest.fn();
      const mockTransaction = { commit, rollback: jest.fn() };
      // @ts-expect-error incomplete mock
      jest.spyOn(ProjectPolygon.sequelize, "transaction").mockResolvedValue(mockTransaction);

      const result = await service.transaction(async () => "success");

      expect(result).toBe("success");
      expect(commit).toHaveBeenCalled();
    });

    it("should rollback a transaction on error", async () => {
      const rollback = jest.fn();
      const mockTransaction = { commit: jest.fn(), rollback };
      // @ts-expect-error incomplete mock
      jest.spyOn(ProjectPolygon.sequelize, "transaction").mockResolvedValue(mockTransaction);

      await expect(
        service.transaction(async () => {
          throw new Error("Test error");
        })
      ).rejects.toThrow("Test error");

      expect(rollback).toHaveBeenCalled();
    });

    it("should throw InternalServerErrorException when sequelize is null", async () => {
      const originalSequelize = ProjectPolygon.sequelize;
      Object.defineProperty(ProjectPolygon, "sequelize", {
        value: null,
        writable: true,
        configurable: true
      });

      await expect(service.transaction(async () => "test")).rejects.toThrow(InternalServerErrorException);

      Object.defineProperty(ProjectPolygon, "sequelize", {
        value: originalSequelize,
        writable: true,
        configurable: true
      });
    });

    it("should throw InternalServerErrorException with correct message", async () => {
      const originalSequelize = ProjectPolygon.sequelize;
      Object.defineProperty(ProjectPolygon, "sequelize", {
        value: null,
        writable: true,
        configurable: true
      });

      await expect(service.transaction(async () => "test")).rejects.toThrow("Database connection not available");

      Object.defineProperty(ProjectPolygon, "sequelize", {
        value: originalSequelize,
        writable: true,
        configurable: true
      });
    });
  });
});

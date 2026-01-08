import { ProjectPolygonsService } from "./project-polygons.service";
import { Test, TestingModule } from "@nestjs/testing";
import { ProjectPolygonFactory, ProjectPitchFactory } from "@terramatch-microservices/database/factories";
import { ProjectPolygon, ProjectPitch, PolygonGeometry } from "@terramatch-microservices/database/entities";
import { InternalServerErrorException, NotFoundException } from "@nestjs/common";
import { ProjectPolygonDto } from "./dto/project-polygon.dto";
import { Transaction } from "sequelize";
import { Polygon } from "geojson";
import { ProjectPolygonGeoJsonQueryDto } from "./dto/project-polygon-geojson-query.dto";

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
      const pitch = await ProjectPitchFactory.build();
      const projectPolygon = await ProjectPolygonFactory.forPitch(pitch).build();

      jest.spyOn(ProjectPitch, "findOne").mockResolvedValue(pitch);
      jest.spyOn(ProjectPolygon, "findOne").mockResolvedValue(projectPolygon);

      const result = await service.findByProjectPitchUuid(pitch.uuid);

      expect(result).not.toBeNull();
      expect(result?.uuid).toBe(projectPolygon.uuid);
      expect(result?.entityId).toBe(pitch.id);
      expect(result?.entityType).toBe(ProjectPitch.LARAVEL_TYPE);
    });

    it("should query with correct parameters", async () => {
      const pitch = await ProjectPitchFactory.build();
      const projectPitchFindOneSpy = jest.spyOn(ProjectPitch, "findOne").mockResolvedValue(pitch);
      const projectPolygonFindOneSpy = jest.spyOn(ProjectPolygon, "findOne").mockResolvedValue(null);

      await service.findByProjectPitchUuid(pitch.uuid);

      expect(projectPitchFindOneSpy).toHaveBeenCalledWith({
        where: { uuid: pitch.uuid },
        attributes: ["id", "uuid"]
      });

      expect(projectPolygonFindOneSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            entityType: ProjectPitch.LARAVEL_TYPE,
            entityId: pitch.id
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
      const projectPolygon = await ProjectPolygonFactory.forPitch().build({
        entityType: "SomeOtherType",
        entityId: 1
      });

      const result = await service.loadProjectPitchAssociation([projectPolygon]);
      expect(result).toEqual({});
    });

    it("should map project pitch IDs to UUIDs", async () => {
      const pitch1 = await ProjectPitchFactory.build();
      const pitch2 = await ProjectPitchFactory.build();

      const projectPolygon1 = await ProjectPolygonFactory.forPitch(pitch1).build();
      const projectPolygon2 = await ProjectPolygonFactory.forPitch(pitch2).build();

      jest.spyOn(ProjectPitch, "findAll").mockResolvedValue([pitch1, pitch2]);

      const result = await service.loadProjectPitchAssociation([projectPolygon1, projectPolygon2]);

      expect(result).toEqual({
        [pitch1.id]: pitch1.uuid,
        [pitch2.id]: pitch2.uuid
      });
    });

    it("should filter out non-project-pitch polygons", async () => {
      const pitch = await ProjectPitchFactory.build();
      const projectPolygon = await ProjectPolygonFactory.forPitch(pitch).build();
      const otherPolygon = await ProjectPolygonFactory.forPitch().build({
        entityType: "SomeOtherType",
        entityId: 999
      });

      const findAllSpy = jest.spyOn(ProjectPitch, "findAll").mockResolvedValue([pitch]);

      await service.loadProjectPitchAssociation([projectPolygon, otherPolygon]);

      expect(findAllSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: expect.objectContaining({
              [Symbol.for("in")]: [pitch.id]
            })
          })
        })
      );
    });
  });

  describe("buildDto", () => {
    it("should build DTO with provided projectPitchUuid", async () => {
      const pitch = await ProjectPitchFactory.build();
      const projectPolygon = await ProjectPolygonFactory.forPitch(pitch).build();

      const dto = await service.buildDto(projectPolygon, pitch.uuid);

      expect(dto).toBeInstanceOf(ProjectPolygonDto);
      expect(dto.uuid).toBe(projectPolygon.uuid);
      expect(dto.projectPitchUuid).toBe(pitch.uuid);
      expect(dto.polygonUuid).toBe(projectPolygon.polyUuid);
    });

    it("should fetch projectPitchUuid when not provided", async () => {
      const pitch = await ProjectPitchFactory.build();
      const projectPolygon = await ProjectPolygonFactory.forPitch(pitch).build();

      jest.spyOn(ProjectPitch, "findByPk").mockResolvedValue(pitch);

      const dto = await service.buildDto(projectPolygon);

      expect(dto.projectPitchUuid).toBe(pitch.uuid);
    });

    it("should set projectPitchUuid to null when project pitch not found", async () => {
      const projectPolygon = await ProjectPolygonFactory.forPitch().build({
        entityId: 999
      });

      jest.spyOn(ProjectPitch, "findByPk").mockResolvedValue(null);

      const dto = await service.buildDto(projectPolygon);

      expect(dto.projectPitchUuid).toBeNull();
    });

    it("should set projectPitchUuid to null for non-project-pitch entities", async () => {
      const projectPolygon = await ProjectPolygonFactory.forPitch().build({
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

  describe("findOne", () => {
    it("should return project polygon when found", async () => {
      const projectPolygon = await ProjectPolygonFactory.forPitch().build();
      jest.spyOn(ProjectPolygon, "findOne").mockResolvedValue(projectPolygon);

      const result = await service.findOne(projectPolygon.uuid);

      expect(result).not.toBeNull();
      if (result !== null) {
        expect(result.uuid).toBe(projectPolygon.uuid);
      }
    });

    it("should return null when project polygon is not found", async () => {
      jest.spyOn(ProjectPolygon, "findOne").mockResolvedValue(null);

      const result = await service.findOne("non-existent-uuid");

      expect(result).toBeNull();
    });

    it("should query with correct parameters", async () => {
      const projectPolygon = await ProjectPolygonFactory.forPitch().build();
      const findOneSpy = jest.spyOn(ProjectPolygon, "findOne").mockResolvedValue(projectPolygon);

      await service.findOne(projectPolygon.uuid);

      expect(findOneSpy).toHaveBeenCalledWith({
        where: { uuid: projectPolygon.uuid },
        attributes: ["id", "uuid", "polyUuid", "entityId", "entityType", "createdBy"]
      });
    });
  });

  describe("deleteProjectPolygon", () => {
    interface MockTransaction {
      commit: jest.Mock;
      rollback: jest.Mock;
    }

    let mockTransaction: MockTransaction;

    beforeEach(() => {
      mockTransaction = {
        commit: jest.fn(),
        rollback: jest.fn()
      };
      const sequelize = ProjectPolygon.sequelize;
      if (sequelize !== null && sequelize !== undefined) {
        // @ts-expect-error incomplete mock
        jest.spyOn(sequelize, "transaction").mockResolvedValue(mockTransaction);
      }
    });

    it("should delete project polygon and polygon geometry", async () => {
      const projectPolygon = await ProjectPolygonFactory.forPitch().build();
      jest.spyOn(ProjectPolygon, "destroy").mockResolvedValue(1);
      jest.spyOn(PolygonGeometry, "destroy").mockResolvedValue(1);

      const result = await service.deleteProjectPolygon(projectPolygon);

      expect(result).toBe(projectPolygon.uuid);
      expect(ProjectPolygon.destroy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { uuid: projectPolygon.uuid }
        })
      );
      expect(PolygonGeometry.destroy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { uuid: projectPolygon.polyUuid }
        })
      );
      expect(mockTransaction.commit).toHaveBeenCalled();
    });

    it("should rollback transaction on error", async () => {
      const projectPolygon = await ProjectPolygonFactory.forPitch().build();
      jest.spyOn(ProjectPolygon, "destroy").mockRejectedValue(new Error("Database error"));

      await expect(service.deleteProjectPolygon(projectPolygon)).rejects.toThrow("Database error");
      expect(mockTransaction.rollback).toHaveBeenCalled();
    });
  });

  describe("deleteProjectPolygonAndGeometry", () => {
    it("should delete project polygon and polygon geometry with provided transaction", async () => {
      const projectPolygon = await ProjectPolygonFactory.forPitch().build();
      const providedTransaction = {
        commit: jest.fn(),
        rollback: jest.fn()
      } as unknown as Transaction;

      jest.spyOn(ProjectPolygon, "destroy").mockResolvedValue(1);
      jest.spyOn(PolygonGeometry, "destroy").mockResolvedValue(1);

      const result = await service.deleteProjectPolygonAndGeometry(projectPolygon, providedTransaction);

      expect(result).toBe(projectPolygon.uuid);
      expect(ProjectPolygon.destroy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { uuid: projectPolygon.uuid },
          transaction: providedTransaction
        })
      );
      expect(PolygonGeometry.destroy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { uuid: projectPolygon.polyUuid },
          transaction: providedTransaction
        })
      );
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
    const mockGeoJsonString = JSON.stringify(mockGeometry);

    it("should return FeatureCollection with geometry and projectPitchUuid in properties", async () => {
      const pitch = await ProjectPitchFactory.build();
      const projectPolygon = await ProjectPolygonFactory.forPitch(pitch).build();
      const query: ProjectPolygonGeoJsonQueryDto = {
        projectPitchUuid: pitch.uuid
      };

      jest.spyOn(ProjectPitch, "findOne").mockResolvedValue(pitch);
      jest.spyOn(ProjectPolygon, "findOne").mockResolvedValue(projectPolygon);
      jest.spyOn(PolygonGeometry, "getGeoJSON").mockResolvedValue(mockGeoJsonString);

      const result = await service.getGeoJson(query);

      expect(result.type).toBe("FeatureCollection");
      expect(result.features).toHaveLength(1);
      expect(result.features[0].type).toBe("Feature");
      expect(result.features[0].geometry).toEqual(mockGeometry);
      expect(result.features[0].properties).toEqual({
        projectPitchUuid: query.projectPitchUuid
      });
    });

    it("should throw NotFoundException when project pitch is not found", async () => {
      const query: ProjectPolygonGeoJsonQueryDto = {
        projectPitchUuid: "non-existent-pitch-uuid"
      };

      jest.spyOn(ProjectPitch, "findOne").mockResolvedValue(null);

      await expect(service.getGeoJson(query)).rejects.toThrow(
        new NotFoundException("Project pitch not found for uuid: non-existent-pitch-uuid")
      );
    });

    it("should throw NotFoundException when project polygon is not found for pitch", async () => {
      const projectPitch = await ProjectPitchFactory.build();
      const query: ProjectPolygonGeoJsonQueryDto = {
        projectPitchUuid: projectPitch.uuid
      };

      jest.spyOn(ProjectPitch, "findOne").mockResolvedValue(projectPitch);
      jest.spyOn(ProjectPolygon, "findOne").mockResolvedValue(null);

      await expect(service.getGeoJson(query)).rejects.toThrow(
        new NotFoundException(`Project polygon not found for project pitch: ${projectPitch.uuid}`)
      );
    });

    it("should throw NotFoundException when polygon geometry UUID is null", async () => {
      const pitch = await ProjectPitchFactory.build();
      const projectPolygon = await ProjectPolygonFactory.forPitch(pitch).build();
      Object.assign(projectPolygon, { polyUuid: null });
      const query: ProjectPolygonGeoJsonQueryDto = {
        projectPitchUuid: pitch.uuid
      };

      jest.spyOn(ProjectPitch, "findOne").mockResolvedValue(pitch);
      jest.spyOn(ProjectPolygon, "findOne").mockResolvedValue(projectPolygon);

      await expect(service.getGeoJson(query)).rejects.toThrow(
        new NotFoundException("Polygon geometry UUID not found for project polygon")
      );
    });

    it("should throw NotFoundException when polygon geometry is not found", async () => {
      const pitch = await ProjectPitchFactory.build();
      const projectPolygon = await ProjectPolygonFactory.forPitch(pitch).build();
      const query: ProjectPolygonGeoJsonQueryDto = {
        projectPitchUuid: pitch.uuid
      };

      jest.spyOn(ProjectPitch, "findOne").mockResolvedValue(pitch);
      jest.spyOn(ProjectPolygon, "findOne").mockResolvedValue(projectPolygon);
      jest.spyOn(PolygonGeometry, "getGeoJSON").mockResolvedValue(undefined);

      await expect(service.getGeoJson(query)).rejects.toThrow(
        new NotFoundException(`Polygon geometry not found for uuid: ${projectPolygon.polyUuid}`)
      );
    });

    it("should throw InternalServerErrorException on invalid geometry JSON", async () => {
      const pitch = await ProjectPitchFactory.build();
      const projectPolygon = await ProjectPolygonFactory.forPitch(pitch).build();
      const query: ProjectPolygonGeoJsonQueryDto = {
        projectPitchUuid: pitch.uuid
      };

      jest.spyOn(ProjectPitch, "findOne").mockResolvedValue(pitch);
      jest.spyOn(ProjectPolygon, "findOne").mockResolvedValue(projectPolygon);
      jest.spyOn(PolygonGeometry, "getGeoJSON").mockResolvedValue("invalid-json");

      await expect(service.getGeoJson(query)).rejects.toThrow(InternalServerErrorException);
    });
  });
});

import { Test, TestingModule } from "@nestjs/testing";
import { PolygonGeometryCreationService } from "./polygon-geometry-creation.service";
import { PolygonGeometry } from "@terramatch-microservices/database/entities";
import { InternalServerErrorException } from "@nestjs/common";
import { Geometry } from "@terramatch-microservices/database/constants";

import { QueryTypes } from "sequelize";

describe("PolygonGeometryCreationService", () => {
  let service: PolygonGeometryCreationService;
  let mockSequelize: { query: jest.Mock };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PolygonGeometryCreationService]
    }).compile();

    service = module.get<PolygonGeometryCreationService>(PolygonGeometryCreationService);

    // Mock sequelize
    mockSequelize = {
      query: jest.fn()
    };

    Object.defineProperty(PolygonGeometry, "sequelize", {
      get: jest.fn(() => mockSequelize),
      configurable: true
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
    // Reset sequelize mock
    Object.defineProperty(PolygonGeometry, "sequelize", {
      get: jest.fn(() => mockSequelize),
      configurable: true
    });
  });

  describe("batchPrepareGeometries", () => {
    it("should return empty array for empty input", async () => {
      const result = await service.batchPrepareGeometries([]);
      expect(result).toEqual([]);
    });

    it("should throw error if sequelize is not available", async () => {
      Object.defineProperty(PolygonGeometry, "sequelize", {
        get: jest.fn(() => null),
        configurable: true
      });

      const geometries: Geometry[] = [
        {
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
        }
      ];

      await expect(service.batchPrepareGeometries(geometries)).rejects.toThrow(InternalServerErrorException);
    });

    it("should process single polygon geometry", async () => {
      const geometries: Geometry[] = [
        {
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
        }
      ];

      const mockGeoJson = JSON.stringify(geometries[0]);
      mockSequelize.query.mockResolvedValue([
        {
          idx: 0,
          geoJson: mockGeoJson,
          area: 10.5
        }
      ]);

      const result = await service.batchPrepareGeometries(geometries);

      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty("uuid");
      expect(result[0]).toHaveProperty("geomJson");
      expect(result[0]).toHaveProperty("area");
      expect(result[0].area).toBe(10.5);
      expect(result[0].geomJson).toBe(mockGeoJson);
      expect(mockSequelize.query).toHaveBeenCalledWith(
        expect.stringContaining("ST_GeomFromGeoJSON"),
        expect.objectContaining({ type: QueryTypes.SELECT })
      );
    });

    it("should process multiple geometries in batch", async () => {
      const geometries: Geometry[] = [
        {
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
        {
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
        }
      ];

      mockSequelize.query.mockResolvedValue([
        { idx: 0, geoJson: JSON.stringify(geometries[0]), area: 10.5 },
        { idx: 1, geoJson: JSON.stringify(geometries[1]), area: 8.3 }
      ]);

      const result = await service.batchPrepareGeometries(geometries);

      expect(result).toHaveLength(2);
      expect(result[0].area).toBe(10.5);
      expect(result[1].area).toBe(8.3);
    });
  });

  describe("bulkInsertGeometries", () => {
    it("should return empty array for empty input", async () => {
      const result = await service.bulkInsertGeometries([], 1);
      expect(result).toEqual([]);
    });

    it("should insert single geometry", async () => {
      const geometriesWithAreas = [
        {
          uuid: "test-uuid",
          geomJson: '{"type":"Polygon","coordinates":[[[0,0],[0,1],[1,1],[1,0],[0,0]]]}',
          area: 10.5
        }
      ];

      mockSequelize.query.mockResolvedValue([]);

      const result = await service.bulkInsertGeometries(geometriesWithAreas, 1);

      expect(result).toEqual(["test-uuid"]);
      expect(mockSequelize.query).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO polygon_geometry"),
        expect.objectContaining({ type: QueryTypes.INSERT })
      );
      expect(mockSequelize.query).toHaveBeenCalledWith(
        expect.stringContaining("ST_GeomFromGeoJSON"),
        expect.anything()
      );
    });

    it("should insert multiple geometries in bulk", async () => {
      const geometriesWithAreas = [
        { uuid: "uuid-1", geomJson: '{"type":"Polygon","coordinates":[[[0,0],[0,1],[1,1],[1,0],[0,0]]]}', area: 10.5 },
        { uuid: "uuid-2", geomJson: '{"type":"Polygon","coordinates":[[[2,2],[2,3],[3,3],[3,2],[2,2]]]}', area: 8.3 }
      ];

      mockSequelize.query.mockResolvedValue([]);

      const result = await service.bulkInsertGeometries(geometriesWithAreas, 1);

      expect(result).toEqual(["uuid-1", "uuid-2"]);
      expect(mockSequelize.query).toHaveBeenCalledTimes(1);
    });

    it("should handle null createdBy", async () => {
      const geometriesWithAreas = [
        { uuid: "uuid-1", geomJson: '{"type":"Polygon","coordinates":[[[0,0],[0,1],[1,1],[1,0],[0,0]]]}', area: 10.5 }
      ];

      mockSequelize.query.mockResolvedValue([]);

      const result = await service.bulkInsertGeometries(geometriesWithAreas, null);

      expect(result).toEqual(["uuid-1"]);
    });
  });

  describe("createGeometriesFromFeatures", () => {
    it("should create geometries from Polygon features", async () => {
      const geometries: Geometry[] = [
        {
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
        }
      ];

      jest
        .spyOn(service, "batchPrepareGeometries")
        .mockResolvedValue([
          { uuid: "uuid-1", geomJson: '{"type":"Polygon","coordinates":[[[0,0],[0,1],[1,1],[1,0],[0,0]]]}', area: 10.5 }
        ]);

      jest.spyOn(service, "bulkInsertGeometries").mockResolvedValue(["uuid-1"]);

      const result = await service.createGeometriesFromFeatures(geometries, 1);

      expect(result.uuids).toEqual(["uuid-1"]);
      expect(result.areas).toEqual([10.5]);
    });

    it("should expand MultiPolygon into individual Polygons", async () => {
      const geometries: Geometry[] = [
        {
          type: "MultiPolygon",
          coordinates: [
            [
              [
                [0, 0],
                [0, 1],
                [1, 1],
                [1, 0],
                [0, 0]
              ]
            ],
            [
              [
                [2, 2],
                [2, 3],
                [3, 3],
                [3, 2],
                [2, 2]
              ]
            ]
          ]
        }
      ];

      jest.spyOn(service, "batchPrepareGeometries").mockResolvedValue([
        { uuid: "uuid-1", geomJson: '{"type":"Polygon","coordinates":[[[0,0],[0,1],[1,1],[1,0],[0,0]]]}', area: 10.5 },
        { uuid: "uuid-2", geomJson: '{"type":"Polygon","coordinates":[[[2,2],[2,3],[3,3],[3,2],[2,2]]]}', area: 8.3 }
      ]);

      jest.spyOn(service, "bulkInsertGeometries").mockResolvedValue(["uuid-1", "uuid-2"]);

      const result = await service.createGeometriesFromFeatures(geometries, 1);

      expect(result.uuids).toHaveLength(2);
      expect(result.areas).toHaveLength(2);
      // batchPrepareGeometries should have been called with 2 expanded Polygon geometries
      expect(service.batchPrepareGeometries).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ type: "Polygon" }),
          expect.objectContaining({ type: "Polygon" })
        ])
      );
    });

    it("should handle mixed Polygon and MultiPolygon geometries", async () => {
      const geometries: Geometry[] = [
        {
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
        {
          type: "MultiPolygon",
          coordinates: [
            [
              [
                [2, 2],
                [2, 3],
                [3, 3],
                [3, 2],
                [2, 2]
              ]
            ]
          ]
        }
      ];

      jest.spyOn(service, "batchPrepareGeometries").mockResolvedValue([
        { uuid: "uuid-1", geomJson: '{"type":"Polygon","coordinates":[[[0,0],[0,1],[1,1],[1,0],[0,0]]]}', area: 10.5 },
        { uuid: "uuid-2", geomJson: '{"type":"Polygon","coordinates":[[[2,2],[2,3],[3,3],[3,2],[2,2]]]}', area: 8.3 }
      ]);

      jest.spyOn(service, "bulkInsertGeometries").mockResolvedValue(["uuid-1", "uuid-2"]);

      const result = await service.createGeometriesFromFeatures(geometries, 1);

      expect(result.uuids).toHaveLength(2);
    });
  });

  describe("bulkUpdateSitePolygonCentroids", () => {
    it("should return early for empty polygon array", async () => {
      await service.bulkUpdateSitePolygonCentroids([]);
      expect(mockSequelize.query).not.toHaveBeenCalled();
    });

    it("should throw error if sequelize is not available", async () => {
      Object.defineProperty(PolygonGeometry, "sequelize", {
        get: jest.fn(() => null),
        configurable: true
      });

      await expect(service.bulkUpdateSitePolygonCentroids(["uuid-1"])).rejects.toThrow(InternalServerErrorException);
    });

    it("should update centroids for site polygons", async () => {
      mockSequelize.query.mockResolvedValue([]);

      await service.bulkUpdateSitePolygonCentroids(["polygon-uuid-1", "polygon-uuid-2"]);

      expect(mockSequelize.query).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE site_polygon"),
        expect.objectContaining({
          type: QueryTypes.UPDATE,
          replacements: expect.objectContaining({
            uuid0: "polygon-uuid-1",
            uuid1: "polygon-uuid-2"
          })
        })
      );
      expect(mockSequelize.query).toHaveBeenCalledWith(
        expect.stringContaining("ST_Y(ST_Centroid(pg.geom))"),
        expect.anything()
      );
      expect(mockSequelize.query).toHaveBeenCalledWith(
        expect.stringContaining("ST_X(ST_Centroid(pg.geom))"),
        expect.anything()
      );
    });
  });

  describe("bulkUpdateSitePolygonAreas", () => {
    it("should return early for empty polygon array", async () => {
      await service.bulkUpdateSitePolygonAreas([]);
      expect(mockSequelize.query).not.toHaveBeenCalled();
    });

    it("should throw error if sequelize is not available", async () => {
      Object.defineProperty(PolygonGeometry, "sequelize", {
        get: jest.fn(() => null),
        configurable: true
      });

      await expect(service.bulkUpdateSitePolygonAreas(["uuid-1"])).rejects.toThrow(InternalServerErrorException);
    });

    it("should update areas for site polygons", async () => {
      mockSequelize.query.mockResolvedValue([]);

      await service.bulkUpdateSitePolygonAreas(["polygon-uuid-1"]);

      expect(mockSequelize.query).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE site_polygon"),
        expect.objectContaining({
          type: QueryTypes.UPDATE,
          replacements: expect.objectContaining({
            uuid0: "polygon-uuid-1"
          })
        })
      );
      expect(mockSequelize.query).toHaveBeenCalledWith(expect.stringContaining("ST_Area(pg.geom)"), expect.anything());
    });
  });

  describe("bulkUpdateProjectCentroids", () => {
    it("should return early for empty polygon array", async () => {
      await service.bulkUpdateProjectCentroids([]);
      expect(mockSequelize.query).not.toHaveBeenCalled();
    });

    it("should throw error if sequelize is not available", async () => {
      Object.defineProperty(PolygonGeometry, "sequelize", {
        get: jest.fn(() => null),
        configurable: true
      });

      await expect(service.bulkUpdateProjectCentroids(["uuid-1"])).rejects.toThrow(InternalServerErrorException);
    });

    it("should update project centroids using ALL active polygons", async () => {
      mockSequelize.query.mockResolvedValue([]);

      await service.bulkUpdateProjectCentroids(["polygon-uuid-1"]);

      expect(mockSequelize.query).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE v2_projects"),
        expect.objectContaining({
          type: QueryTypes.UPDATE,
          replacements: expect.objectContaining({
            uuid0: "polygon-uuid-1"
          })
        })
      );
      // Should use subquery to get project_id
      expect(mockSequelize.query).toHaveBeenCalledWith(
        expect.stringContaining("SELECT DISTINCT s2.project_id"),
        expect.anything()
      );
      // Should filter by active polygons
      expect(mockSequelize.query).toHaveBeenCalledWith(expect.stringContaining("sp.is_active = 1"), expect.anything());
      // Should calculate average centroids
      expect(mockSequelize.query).toHaveBeenCalledWith(
        expect.stringContaining("AVG(ST_Y(ST_Centroid(pg.geom)))"),
        expect.anything()
      );
      expect(mockSequelize.query).toHaveBeenCalledWith(
        expect.stringContaining("AVG(ST_X(ST_Centroid(pg.geom)))"),
        expect.anything()
      );
    });

    it("should handle errors gracefully", async () => {
      mockSequelize.query.mockRejectedValue(new Error("Database error"));

      await expect(service.bulkUpdateProjectCentroids(["polygon-uuid-1"])).rejects.toThrow(
        InternalServerErrorException
      );
    });
  });
});

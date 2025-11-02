import { Test, TestingModule } from "@nestjs/testing";
import { PointGeometryCreationService } from "./point-geometry-creation.service";
import { PointGeometry } from "@terramatch-microservices/database/entities";
import { InternalServerErrorException } from "@nestjs/common";
import { QueryTypes, Transaction } from "sequelize";
import { Feature } from "./dto/create-site-polygon-request.dto";

describe("PointGeometryCreationService", () => {
  let service: PointGeometryCreationService;
  let mockSequelize: { query: jest.Mock };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PointGeometryCreationService]
    }).compile();

    service = module.get<PointGeometryCreationService>(PointGeometryCreationService);

    mockSequelize = {
      query: jest.fn().mockResolvedValue([[], 0])
    };

    Object.defineProperty(PointGeometry, "sequelize", {
      get: jest.fn(() => mockSequelize),
      configurable: true
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(PointGeometry, "sequelize", {
      get: jest.fn(() => mockSequelize),
      configurable: true
    });
  });

  const createPointFeature = (
    lon: number,
    lat: number,
    estArea?: number,
    properties: Record<string, unknown> = {}
  ): Feature => ({
    type: "Feature",
    geometry: {
      type: "Point",
      coordinates: [lon, lat]
    },
    properties: {
      site_id: "test-site",
      ...(estArea != null && { est_area: estArea }),
      ...properties
    }
  });

  describe("createPointGeometriesFromFeatures", () => {
    it("should return empty array for empty input", async () => {
      const result = await service.createPointGeometriesFromFeatures([], null);
      expect(result).toEqual([]);
      expect(mockSequelize.query).not.toHaveBeenCalled();
    });

    it("should throw error if PointGeometry.sequelize is null", async () => {
      Object.defineProperty(PointGeometry, "sequelize", {
        get: jest.fn(() => null),
        configurable: true
      });

      const features = [createPointFeature(0, 0, 1.0)];

      await expect(service.createPointGeometriesFromFeatures(features, null)).rejects.toThrow(
        InternalServerErrorException
      );
      await expect(service.createPointGeometriesFromFeatures(features, null)).rejects.toThrow(
        "PointGeometry model is missing sequelize connection"
      );
    });

    it("should create single point geometry", async () => {
      const features = [createPointFeature(0, 0, 1.5)];

      const result = await service.createPointGeometriesFromFeatures(features, 123);

      expect(result).toHaveLength(1);
      expect(result[0]).toBeDefined();
      expect(typeof result[0]).toBe("string");

      expect(mockSequelize.query).toHaveBeenCalledTimes(1);
      const queryCall = mockSequelize.query.mock.calls[0];
      expect(queryCall[0]).toContain("INSERT INTO point_geometry");
      expect(queryCall[0]).toContain("uuid");
      expect(queryCall[0]).toContain("geom");
      expect(queryCall[0]).toContain("est_area");
      expect(queryCall[0]).toContain("created_by");
      expect(queryCall[1]).toHaveProperty("replacements");
      expect(queryCall[1]).toHaveProperty("type");
      expect(queryCall[1].type).toBe(QueryTypes.INSERT);
      expect(queryCall[1].transaction).toBeUndefined();
    });

    it("should create multiple point geometries", async () => {
      const features = [createPointFeature(0, 0, 1.0), createPointFeature(1, 1, 2.5), createPointFeature(-1, -1, 3.0)];

      const result = await service.createPointGeometriesFromFeatures(features, 456);

      expect(result).toHaveLength(3);
      result.forEach(uuid => {
        expect(typeof uuid).toBe("string");
        expect(uuid.length).toBeGreaterThan(0);
      });

      expect(mockSequelize.query).toHaveBeenCalledTimes(1);
      const queryCall = mockSequelize.query.mock.calls[0];
      expect(queryCall[0]).toContain("VALUES");
      // Each feature creates one value set, so there should be at least 3 opening parentheses in VALUES clause
      expect(queryCall[0].match(/VALUES\s*\(/g)?.length ?? 0).toBeGreaterThanOrEqual(1);

      const replacements = queryCall[1].replacements;
      expect(replacements).toHaveProperty("uuid0");
      expect(replacements).toHaveProperty("uuid1");
      expect(replacements).toHaveProperty("uuid2");
      expect(replacements).toHaveProperty("geomJson0");
      expect(replacements).toHaveProperty("geomJson1");
      expect(replacements).toHaveProperty("geomJson2");
      expect(replacements).toHaveProperty("estArea0");
      expect(replacements).toHaveProperty("estArea1");
      expect(replacements).toHaveProperty("estArea2");
    });

    it("should handle features with est_area property", async () => {
      const features = [createPointFeature(0, 0, 5.5)];

      await service.createPointGeometriesFromFeatures(features, null);

      const queryCall = mockSequelize.query.mock.calls[0];
      const replacements = queryCall[1].replacements;
      expect(replacements.estArea0).toBe(5.5);
    });

    it("should handle features without est_area property", async () => {
      const features: Feature[] = [
        {
          type: "Feature",
          geometry: {
            type: "Point",
            coordinates: [0, 0]
          },
          properties: {
            site_id: "test-site"
          }
        }
      ];

      await service.createPointGeometriesFromFeatures(features, null);

      const queryCall = mockSequelize.query.mock.calls[0];
      const replacements = queryCall[1].replacements;
      expect(replacements.estArea0).toBeNull();
    });

    it("should handle features with minimal properties", async () => {
      const features: Feature[] = [
        {
          type: "Feature",
          geometry: {
            type: "Point",
            coordinates: [0, 0]
          },
          properties: {
            site_id: "test-site"
          }
        }
      ];

      await service.createPointGeometriesFromFeatures(features, null);

      const queryCall = mockSequelize.query.mock.calls[0];
      const replacements = queryCall[1].replacements;
      expect(replacements.estArea0).toBeNull();
    });

    it("should use createdBy parameter in query", async () => {
      const features = [createPointFeature(0, 0, 1.0)];

      await service.createPointGeometriesFromFeatures(features, 789);

      const queryCall = mockSequelize.query.mock.calls[0];
      const replacements = queryCall[1].replacements;
      expect(replacements.createdBy0).toBe(789);
    });

    it("should handle null createdBy parameter", async () => {
      const features = [createPointFeature(0, 0, 1.0)];

      await service.createPointGeometriesFromFeatures(features, null);

      const queryCall = mockSequelize.query.mock.calls[0];
      const replacements = queryCall[1].replacements;
      expect(replacements.createdBy0).toBeNull();
    });

    it("should pass transaction to query when provided", async () => {
      const features = [createPointFeature(0, 0, 1.0)];
      const mockTransaction = {} as Transaction;

      await service.createPointGeometriesFromFeatures(features, 123, mockTransaction);

      const queryCall = mockSequelize.query.mock.calls[0];
      expect(queryCall[1].type).toBe(QueryTypes.INSERT);
      expect(queryCall[1].transaction).toBe(mockTransaction);
    });

    it("should serialize geometry as GeoJSON", async () => {
      const features = [createPointFeature(10.5, 20.3, 1.0)];

      await service.createPointGeometriesFromFeatures(features, null);

      const queryCall = mockSequelize.query.mock.calls[0];
      const replacements = queryCall[1].replacements;
      const geomJson = JSON.parse(replacements.geomJson0 as string);
      expect(geomJson.type).toBe("Point");
      expect(geomJson.coordinates).toEqual([10.5, 20.3]);
    });

    it("should generate unique UUIDs for each geometry", async () => {
      const features = [createPointFeature(0, 0, 1.0), createPointFeature(1, 1, 2.0), createPointFeature(2, 2, 3.0)];

      const result = await service.createPointGeometriesFromFeatures(features, null);

      expect(result.length).toBe(3);
      expect(new Set(result).size).toBe(3);

      const queryCall = mockSequelize.query.mock.calls[0];
      const replacements = queryCall[1].replacements;
      expect(replacements.uuid0).not.toBe(replacements.uuid1);
      expect(replacements.uuid1).not.toBe(replacements.uuid2);
      expect(replacements.uuid0).not.toBe(replacements.uuid2);
    });

    it("should log success message", async () => {
      const loggerSpy = jest.spyOn(service["logger"], "log");
      const features = [createPointFeature(0, 0, 1.0)];

      await service.createPointGeometriesFromFeatures(features, null);

      expect(loggerSpy).toHaveBeenCalledWith("Created 1 point geometries");
    });

    it("should handle database errors and throw InternalServerErrorException", async () => {
      jest.spyOn(service["logger"], "error").mockImplementation(() => {
        // Suppress console output during test
      });
      const error = new Error("Database connection failed");
      mockSequelize.query.mockRejectedValue(error);

      const features = [createPointFeature(0, 0, 1.0)];

      await expect(service.createPointGeometriesFromFeatures(features, null)).rejects.toThrow(
        InternalServerErrorException
      );
      await expect(service.createPointGeometriesFromFeatures(features, null)).rejects.toThrow(
        "Failed to create point geometries: Database connection failed"
      );
    });

    it("should handle non-Error exceptions", async () => {
      jest.spyOn(service["logger"], "error").mockImplementation(() => {
        // Suppress console output during test
      });
      mockSequelize.query.mockRejectedValue("String error");

      const features = [createPointFeature(0, 0, 1.0)];

      await expect(service.createPointGeometriesFromFeatures(features, null)).rejects.toThrow(
        InternalServerErrorException
      );
      await expect(service.createPointGeometriesFromFeatures(features, null)).rejects.toThrow(
        "Failed to create point geometries: String error"
      );
    });

    it("should log error details", async () => {
      const loggerErrorSpy = jest.spyOn(service["logger"], "error").mockImplementation(() => {
        // Suppress console output during test
      });
      const error = new Error("Database error");
      mockSequelize.query.mockRejectedValueOnce(error);

      const features = [createPointFeature(0, 0, 1.0)];

      await expect(service.createPointGeometriesFromFeatures(features, null)).rejects.toThrow();

      expect(loggerErrorSpy).toHaveBeenCalledWith("Error bulk inserting point geometries", error);

      loggerErrorSpy.mockRestore();
    });

    it("should build correct SQL query with all replacements", async () => {
      const features = [createPointFeature(0, 0, 1.0), createPointFeature(1, 1, 2.0)];

      await service.createPointGeometriesFromFeatures(features, 100);

      const queryCall = mockSequelize.query.mock.calls[0];
      const query = queryCall[0] as string;
      const replacements = queryCall[1].replacements;

      expect(query).toContain("INSERT INTO point_geometry");
      expect(query).toContain("VALUES");
      expect(query).toContain(":uuid0");
      expect(query).toContain(":uuid1");
      expect(query).toContain("ST_GeomFromGeoJSON(:geomJson0)");
      expect(query).toContain("ST_GeomFromGeoJSON(:geomJson1)");

      expect(replacements).toHaveProperty("uuid0");
      expect(replacements).toHaveProperty("uuid1");
      expect(replacements).toHaveProperty("geomJson0");
      expect(replacements).toHaveProperty("geomJson1");
      expect(replacements).toHaveProperty("estArea0");
      expect(replacements).toHaveProperty("estArea1");
      expect(replacements).toHaveProperty("createdBy0");
      expect(replacements).toHaveProperty("createdBy1");
      expect(replacements.createdBy0).toBe(100);
      expect(replacements.createdBy1).toBe(100);
    });

    it("should handle features with mixed est_area values", async () => {
      const features = [createPointFeature(0, 0, 1.0), createPointFeature(1, 1), createPointFeature(2, 2, 3.0)];

      await service.createPointGeometriesFromFeatures(features, null);

      const queryCall = mockSequelize.query.mock.calls[0];
      const replacements = queryCall[1].replacements;
      expect(replacements.estArea0).toBe(1.0);
      expect(replacements.estArea1).toBeNull();
      expect(replacements.estArea2).toBe(3.0);
    });
  });
});

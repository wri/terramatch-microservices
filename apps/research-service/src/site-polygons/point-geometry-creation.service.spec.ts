import { Test, TestingModule } from "@nestjs/testing";
import { PointGeometryCreationService } from "./point-geometry-creation.service";
import { PointGeometry } from "@terramatch-microservices/database/entities";
import { InternalServerErrorException } from "@nestjs/common";
import { Transaction } from "sequelize";
import { Feature } from "./dto/create-site-polygon-request.dto";

describe("PointGeometryCreationService", () => {
  let service: PointGeometryCreationService;
  let mockSequelize: { query: jest.Mock };
  let mockBulkCreate: jest.Mock;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PointGeometryCreationService]
    }).compile();

    service = module.get<PointGeometryCreationService>(PointGeometryCreationService);

    mockSequelize = {
      query: jest.fn().mockResolvedValue([[], 0])
    };

    mockBulkCreate = jest.fn();

    Object.defineProperty(PointGeometry, "sequelize", {
      get: jest.fn(() => mockSequelize),
      configurable: true
    });

    (PointGeometry.bulkCreate as jest.Mock) = mockBulkCreate;
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

  const createMockPointGeometry = (
    uuid: string,
    point: { type: string; coordinates: number[] },
    estimatedArea: number | null,
    createdBy: number | null
  ) => ({ uuid, point, estimatedArea, createdBy } as PointGeometry);

  describe("createPointGeometriesFromFeatures", () => {
    it("should return empty array for empty input", async () => {
      const result = await service.createPointGeometriesFromFeatures([], null);
      expect(result).toEqual([]);
      expect(mockBulkCreate).not.toHaveBeenCalled();
    });

    it("should create single point geometry", async () => {
      const features = [createPointFeature(0, 0, 1.5)];
      const mockUuid = "test-uuid-1";
      const mockPoint = { type: "Point", coordinates: [0, 0] };
      const mockCreated = [createMockPointGeometry(mockUuid, mockPoint, 1.5, 123)];
      mockBulkCreate.mockResolvedValue(mockCreated);

      const result = await service.createPointGeometriesFromFeatures(features, 123);

      expect(result).toHaveLength(1);
      expect(result[0]).toBe(mockUuid);

      expect(mockBulkCreate).toHaveBeenCalledTimes(1);
      const bulkCreateCall = mockBulkCreate.mock.calls[0];
      expect(bulkCreateCall[0]).toHaveLength(1);
      expect(bulkCreateCall[0][0]).toMatchObject({
        point: mockPoint,
        estimatedArea: 1.5,
        createdBy: 123
      });
      expect(bulkCreateCall[0][0].uuid).toBeDefined();
      expect(bulkCreateCall[1]).toEqual({ transaction: undefined });
    });

    it("should create multiple point geometries", async () => {
      const features = [createPointFeature(0, 0, 1.0), createPointFeature(1, 1, 2.5), createPointFeature(-1, -1, 3.0)];
      const mockCreated = [
        createMockPointGeometry("uuid-1", { type: "Point", coordinates: [0, 0] }, 1.0, 456),
        createMockPointGeometry("uuid-2", { type: "Point", coordinates: [1, 1] }, 2.5, 456),
        createMockPointGeometry("uuid-3", { type: "Point", coordinates: [-1, -1] }, 3.0, 456)
      ];
      mockBulkCreate.mockResolvedValue(mockCreated);

      const result = await service.createPointGeometriesFromFeatures(features, 456);

      expect(result).toHaveLength(3);
      expect(result).toEqual(["uuid-1", "uuid-2", "uuid-3"]);

      expect(mockBulkCreate).toHaveBeenCalledTimes(1);
      const bulkCreateCall = mockBulkCreate.mock.calls[0];
      expect(bulkCreateCall[0]).toHaveLength(3);
      expect(bulkCreateCall[0][0]).toMatchObject({
        point: { type: "Point", coordinates: [0, 0] },
        estimatedArea: 1.0,
        createdBy: 456
      });
      expect(bulkCreateCall[0][1]).toMatchObject({
        point: { type: "Point", coordinates: [1, 1] },
        estimatedArea: 2.5,
        createdBy: 456
      });
      expect(bulkCreateCall[0][2]).toMatchObject({
        point: { type: "Point", coordinates: [-1, -1] },
        estimatedArea: 3.0,
        createdBy: 456
      });
    });

    it("should handle features with est_area property", async () => {
      const features = [createPointFeature(0, 0, 5.5)];
      const mockCreated = [createMockPointGeometry("uuid-1", { type: "Point", coordinates: [0, 0] }, 5.5, null)];
      mockBulkCreate.mockResolvedValue(mockCreated);

      await service.createPointGeometriesFromFeatures(features, null);

      expect(mockBulkCreate).toHaveBeenCalledTimes(1);
      const bulkCreateCall = mockBulkCreate.mock.calls[0];
      expect(bulkCreateCall[0][0].estimatedArea).toBe(5.5);
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
      const mockCreated = [createMockPointGeometry("uuid-1", { type: "Point", coordinates: [0, 0] }, null, null)];
      mockBulkCreate.mockResolvedValue(mockCreated);

      await service.createPointGeometriesFromFeatures(features, null);

      expect(mockBulkCreate).toHaveBeenCalledTimes(1);
      const bulkCreateCall = mockBulkCreate.mock.calls[0];
      expect(bulkCreateCall[0][0].estimatedArea).toBeNull();
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
      const mockCreated = [createMockPointGeometry("uuid-1", { type: "Point", coordinates: [0, 0] }, null, null)];
      mockBulkCreate.mockResolvedValue(mockCreated);

      await service.createPointGeometriesFromFeatures(features, null);

      expect(mockBulkCreate).toHaveBeenCalledTimes(1);
      const bulkCreateCall = mockBulkCreate.mock.calls[0];
      expect(bulkCreateCall[0][0].estimatedArea).toBeNull();
    });

    it("should use createdBy parameter in query", async () => {
      const features = [createPointFeature(0, 0, 1.0)];
      const mockCreated = [createMockPointGeometry("uuid-1", { type: "Point", coordinates: [0, 0] }, 1.0, 789)];
      mockBulkCreate.mockResolvedValue(mockCreated);

      await service.createPointGeometriesFromFeatures(features, 789);

      expect(mockBulkCreate).toHaveBeenCalledTimes(1);
      const bulkCreateCall = mockBulkCreate.mock.calls[0];
      expect(bulkCreateCall[0][0].createdBy).toBe(789);
    });

    it("should handle null createdBy parameter", async () => {
      const features = [createPointFeature(0, 0, 1.0)];
      const mockCreated = [createMockPointGeometry("uuid-1", { type: "Point", coordinates: [0, 0] }, 1.0, null)];
      mockBulkCreate.mockResolvedValue(mockCreated);

      await service.createPointGeometriesFromFeatures(features, null);

      expect(mockBulkCreate).toHaveBeenCalledTimes(1);
      const bulkCreateCall = mockBulkCreate.mock.calls[0];
      expect(bulkCreateCall[0][0].createdBy).toBeNull();
    });

    it("should pass transaction to bulkCreate when provided", async () => {
      const features = [createPointFeature(0, 0, 1.0)];
      const mockTransaction = {} as Transaction;
      const mockCreated = [createMockPointGeometry("uuid-1", { type: "Point", coordinates: [0, 0] }, 1.0, 123)];
      mockBulkCreate.mockResolvedValue(mockCreated);

      await service.createPointGeometriesFromFeatures(features, 123, mockTransaction);

      expect(mockBulkCreate).toHaveBeenCalledTimes(1);
      const bulkCreateCall = mockBulkCreate.mock.calls[0];
      expect(bulkCreateCall[1]).toEqual({ transaction: mockTransaction });
    });

    it("should pass geometry as GeoJSON Point object", async () => {
      const features = [createPointFeature(10.5, 20.3, 1.0)];
      const mockPoint = { type: "Point", coordinates: [10.5, 20.3] };
      const mockCreated = [createMockPointGeometry("uuid-1", mockPoint, 1.0, null)];
      mockBulkCreate.mockResolvedValue(mockCreated);

      await service.createPointGeometriesFromFeatures(features, null);

      expect(mockBulkCreate).toHaveBeenCalledTimes(1);
      const bulkCreateCall = mockBulkCreate.mock.calls[0];
      expect(bulkCreateCall[0][0].point).toEqual(mockPoint);
    });

    it("should generate unique UUIDs for each geometry", async () => {
      const features = [createPointFeature(0, 0, 1.0), createPointFeature(1, 1, 2.0), createPointFeature(2, 2, 3.0)];
      const mockCreated = [
        createMockPointGeometry("uuid-1", { type: "Point", coordinates: [0, 0] }, 1.0, null),
        createMockPointGeometry("uuid-2", { type: "Point", coordinates: [1, 1] }, 2.0, null),
        createMockPointGeometry("uuid-3", { type: "Point", coordinates: [2, 2] }, 3.0, null)
      ];
      mockBulkCreate.mockResolvedValue(mockCreated);

      const result = await service.createPointGeometriesFromFeatures(features, null);

      expect(result.length).toBe(3);
      expect(new Set(result).size).toBe(3);

      const bulkCreateCall = mockBulkCreate.mock.calls[0];
      const uuids = bulkCreateCall[0].map((item: { uuid: string }) => item.uuid);
      expect(uuids[0]).not.toBe(uuids[1]);
      expect(uuids[1]).not.toBe(uuids[2]);
      expect(uuids[0]).not.toBe(uuids[2]);
    });

    it("should handle database errors and throw InternalServerErrorException", async () => {
      jest.spyOn(service["logger"], "error").mockImplementation(() => {
        // Suppress console output during test
      });
      const error = new Error("Database connection failed");
      mockBulkCreate.mockRejectedValue(error);

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
      mockBulkCreate.mockRejectedValue("String error");

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
      mockBulkCreate.mockRejectedValueOnce(error);

      const features = [createPointFeature(0, 0, 1.0)];

      await expect(service.createPointGeometriesFromFeatures(features, null)).rejects.toThrow();

      expect(loggerErrorSpy).toHaveBeenCalledWith("Error bulk inserting point geometries", error);

      loggerErrorSpy.mockRestore();
    });

    it("should call bulkCreate with correct data", async () => {
      const features = [createPointFeature(0, 0, 1.0), createPointFeature(1, 1, 2.0)];
      const mockCreated = [
        createMockPointGeometry("uuid-1", { type: "Point", coordinates: [0, 0] }, 1.0, 100),
        createMockPointGeometry("uuid-2", { type: "Point", coordinates: [1, 1] }, 2.0, 100)
      ];
      mockBulkCreate.mockResolvedValue(mockCreated);

      await service.createPointGeometriesFromFeatures(features, 100);

      expect(mockBulkCreate).toHaveBeenCalledTimes(1);
      const bulkCreateCall = mockBulkCreate.mock.calls[0];
      expect(bulkCreateCall[0]).toHaveLength(2);
      expect(bulkCreateCall[0][0]).toMatchObject({
        point: { type: "Point", coordinates: [0, 0] },
        estimatedArea: 1.0,
        createdBy: 100
      });
      expect(bulkCreateCall[0][1]).toMatchObject({
        point: { type: "Point", coordinates: [1, 1] },
        estimatedArea: 2.0,
        createdBy: 100
      });
      expect(bulkCreateCall[0][0].uuid).toBeDefined();
      expect(bulkCreateCall[0][1].uuid).toBeDefined();
    });

    it("should handle features with mixed est_area values", async () => {
      const features = [createPointFeature(0, 0, 1.0), createPointFeature(1, 1), createPointFeature(2, 2, 3.0)];
      const mockCreated = [
        createMockPointGeometry("uuid-1", { type: "Point", coordinates: [0, 0] }, 1.0, null),
        createMockPointGeometry("uuid-2", { type: "Point", coordinates: [1, 1] }, null, null),
        createMockPointGeometry("uuid-3", { type: "Point", coordinates: [2, 2] }, 3.0, null)
      ];
      mockBulkCreate.mockResolvedValue(mockCreated);

      await service.createPointGeometriesFromFeatures(features, null);

      expect(mockBulkCreate).toHaveBeenCalledTimes(1);
      const bulkCreateCall = mockBulkCreate.mock.calls[0];
      expect(bulkCreateCall[0][0].estimatedArea).toBe(1.0);
      expect(bulkCreateCall[0][1].estimatedArea).toBeNull();
      expect(bulkCreateCall[0][2].estimatedArea).toBe(3.0);
    });
  });
});

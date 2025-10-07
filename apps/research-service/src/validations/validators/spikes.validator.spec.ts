import { Test, TestingModule } from "@nestjs/testing";
import { SpikesValidator } from "./spikes.validator";
import { PolygonGeometry } from "@terramatch-microservices/database/entities";
import { Polygon } from "geojson";

interface SpikeExtraInfo {
  spikes: number[][];
  spikeCount: number;
}

interface ErrorExtraInfo {
  error: string;
}

interface GeoJSONPolygon {
  type: "Polygon";
  coordinates: number[][][];
}

interface GeoJSONMultiPolygon {
  type: "MultiPolygon";
  coordinates: number[][][][];
}

jest.mock("@terramatch-microservices/database/entities", () => ({
  PolygonGeometry: {
    sequelize: null,
    getGeoJSONParsed: jest.fn(),
    getGeoJSONBatchParsed: jest.fn()
  }
}));

describe("SpikesValidator", () => {
  let validator: SpikesValidator;
  let mockGetGeoJSONParsed: jest.MockedFunction<typeof PolygonGeometry.getGeoJSONParsed>;
  let mockGetGeoJSONBatchParsed: jest.MockedFunction<typeof PolygonGeometry.getGeoJSONBatchParsed>;

  const TEST_POLYGONS: {
    VALID_NO_SPIKES: GeoJSONPolygon;
    INVALID_WITH_SPIKES: GeoJSONPolygon;
    MULTI_POLYGON_VALID: GeoJSONMultiPolygon;
  } = {
    VALID_NO_SPIKES: {
      type: "Polygon",
      coordinates: [
        [
          [33.08793397091034, -2.0110453510043698],
          [33.08793108280574, -2.014462908508264],
          [33.09279555773685, -2.0156659101236016],
          [33.093202358829984, -2.012849711983364],
          [33.093200176401695, -2.0096319653234502],
          [33.08793397091034, -2.0110453510043698]
        ]
      ]
    },
    INVALID_WITH_SPIKES: {
      type: "Polygon",
      coordinates: [
        [
          [33.0532174455731, -2.0235234982835237],
          [33.0532174455731, -2.023961881360833],
          [33.05375358151258, -2.0241323636379036],
          [33.05426534763643, -2.0238888175230443],
          [33.05426534763643, -2.0235722075195923],
          [33.05421660800633, -2.02308511508636],
          [33.05377795132836, -2.02303640583429],
          [33.05338803428191, -2.0229389873271515],
          [32.96613893328197, -1.85418173381602],
          [33.0533135885056, -2.0230763147354196],
          [33.0532174455731, -2.0235234982835237]
        ]
      ]
    },
    MULTI_POLYGON_VALID: {
      type: "MultiPolygon",
      coordinates: [
        [
          [
            [33.08793397091034, -2.0110453510043698],
            [33.08793108280574, -2.014462908508264],
            [33.09279555773685, -2.0156659101236016],
            [33.093202358829984, -2.012849711983364],
            [33.093200176401695, -2.0096319653234502],
            [33.08793397091034, -2.0110453510043698]
          ]
        ]
      ]
    }
  };

  beforeEach(async () => {
    mockGetGeoJSONParsed = PolygonGeometry.getGeoJSONParsed as jest.MockedFunction<
      typeof PolygonGeometry.getGeoJSONParsed
    >;
    mockGetGeoJSONBatchParsed = PolygonGeometry.getGeoJSONBatchParsed as jest.MockedFunction<
      typeof PolygonGeometry.getGeoJSONBatchParsed
    >;

    const module: TestingModule = await Test.createTestingModule({
      providers: [SpikesValidator]
    }).compile();

    validator = module.get<SpikesValidator>(SpikesValidator);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("validatePolygon", () => {
    it("should return valid=true for polygon without spikes", async () => {
      const polygonUuid = "test-uuid-1";
      mockGetGeoJSONParsed.mockResolvedValue(TEST_POLYGONS.VALID_NO_SPIKES as unknown as Polygon);

      const result = await validator.validatePolygon(polygonUuid);

      expect(result).toEqual({
        valid: true,
        extraInfo: {
          spikes: [],
          spikeCount: 0
        }
      });
      expect(mockGetGeoJSONParsed).toHaveBeenCalledWith(polygonUuid);
    });

    it("should return valid=false for polygon with spikes", async () => {
      const polygonUuid = "test-uuid-2";
      mockGetGeoJSONParsed.mockResolvedValue(TEST_POLYGONS.INVALID_WITH_SPIKES as unknown as Polygon);

      const result = await validator.validatePolygon(polygonUuid);

      expect(result.valid).toBe(false);
      expect(result.extraInfo).toBeDefined();
      expect(result.extraInfo?.spikeCount).toBeGreaterThan(0);
      expect(Array.isArray(result.extraInfo?.spikes)).toBe(true);
      expect(mockGetGeoJSONParsed).toHaveBeenCalledWith(polygonUuid);
    });

    it("should handle MultiPolygon geometry", async () => {
      const polygonUuid = "test-uuid-3";
      mockGetGeoJSONParsed.mockResolvedValue(TEST_POLYGONS.MULTI_POLYGON_VALID as unknown as Polygon);

      const result = await validator.validatePolygon(polygonUuid);

      expect(result.valid).toBe(true);
      expect(result.extraInfo?.spikeCount).toBe(0);
      expect(mockGetGeoJSONParsed).toHaveBeenCalledWith(polygonUuid);
    });

    it("should throw error when polygon is not found", async () => {
      const polygonUuid = "non-existent-uuid";
      const { NotFoundException } = await import("@nestjs/common");
      mockGetGeoJSONParsed.mockResolvedValue(undefined);

      await expect(validator.validatePolygon(polygonUuid)).rejects.toThrow(NotFoundException);
    });

    it("should throw error when sequelize connection is missing", async () => {
      const polygonUuid = "test-uuid";
      const { InternalServerErrorException } = await import("@nestjs/common");
      mockGetGeoJSONParsed.mockRejectedValue(
        new InternalServerErrorException("PolygonGeometry model is missing sequelize connection")
      );

      await expect(validator.validatePolygon(polygonUuid)).rejects.toThrow(InternalServerErrorException);
    });

    it("should handle invalid GeoJSON data", async () => {
      const polygonUuid = "test-uuid";
      const invalidGeoJson = "invalid json" as unknown as Polygon;
      mockGetGeoJSONParsed.mockResolvedValue(invalidGeoJson);

      const result = await validator.validatePolygon(polygonUuid);

      expect(result.valid).toBe(true);
      expect(result.extraInfo?.spikeCount).toBe(0);
    });

    it("should handle database query errors", async () => {
      const polygonUuid = "test-uuid";
      const dbError = new Error("Database connection failed");
      mockGetGeoJSONParsed.mockRejectedValue(dbError);

      await expect(validator.validatePolygon(polygonUuid)).rejects.toThrow(dbError);
    });
  });

  describe("validatePolygons", () => {
    it("should validate multiple polygons successfully", async () => {
      const polygonUuids = ["uuid-1", "uuid-2"];
      const mockResults = [
        { uuid: "uuid-1", geoJson: TEST_POLYGONS.VALID_NO_SPIKES as unknown as Polygon },
        { uuid: "uuid-2", geoJson: TEST_POLYGONS.INVALID_WITH_SPIKES as unknown as Polygon }
      ];
      mockGetGeoJSONBatchParsed.mockResolvedValue(mockResults);

      const result = await validator.validatePolygons(polygonUuids);

      expect(result).toHaveLength(2);
      expect(result[0].polygonUuid).toBe("uuid-1");
      expect(result[0].valid).toBe(true);
      expect((result[0].extraInfo as SpikeExtraInfo)?.spikeCount).toBe(0);

      expect(result[1].polygonUuid).toBe("uuid-2");
      expect(result[1].valid).toBe(false);
      expect((result[1].extraInfo as SpikeExtraInfo)?.spikeCount).toBeGreaterThan(0);
      expect(mockGetGeoJSONBatchParsed).toHaveBeenCalledWith(polygonUuids);
    });

    it("should handle missing polygons in results", async () => {
      const polygonUuids = ["uuid-1", "uuid-2", "uuid-3"];
      const mockResults = [{ uuid: "uuid-1", geoJson: TEST_POLYGONS.VALID_NO_SPIKES as unknown as Polygon }];
      mockGetGeoJSONBatchParsed.mockResolvedValue(mockResults);

      const result = await validator.validatePolygons(polygonUuids);

      expect(result).toHaveLength(3);
      expect(result[0].valid).toBe(true);
      expect(result[1].valid).toBe(false);
      expect((result[1].extraInfo as ErrorExtraInfo)?.error).toBe("Polygon not found");
      expect(result[2].valid).toBe(false);
      expect((result[2].extraInfo as ErrorExtraInfo)?.error).toBe("Polygon not found");
    });

    it("should handle empty polygon list", async () => {
      const polygonUuids: string[] = [];
      mockGetGeoJSONBatchParsed.mockResolvedValue([]);

      const result = await validator.validatePolygons(polygonUuids);

      expect(result).toEqual([]);
      expect(mockGetGeoJSONBatchParsed).toHaveBeenCalledWith([]);
    });

    it("should throw error when sequelize connection is missing", async () => {
      const polygonUuids = ["uuid-1"];
      const { InternalServerErrorException } = await import("@nestjs/common");
      mockGetGeoJSONBatchParsed.mockRejectedValue(
        new InternalServerErrorException("PolygonGeometry model is missing sequelize connection")
      );

      await expect(validator.validatePolygons(polygonUuids)).rejects.toThrow(InternalServerErrorException);
    });

    it("should handle database query errors", async () => {
      const polygonUuids = ["uuid-1"];
      const dbError = new Error("Database connection failed");
      mockGetGeoJSONBatchParsed.mockRejectedValue(dbError);

      await expect(validator.validatePolygons(polygonUuids)).rejects.toThrow(dbError);
    });
  });

  describe("detectSpikes (private method testing through public methods)", () => {
    it("should detect spikes in complex polygon", async () => {
      const polygonUuid = "test-uuid";
      mockGetGeoJSONParsed.mockResolvedValue(TEST_POLYGONS.INVALID_WITH_SPIKES as unknown as Polygon);

      const result = await validator.validatePolygon(polygonUuid);

      expect(result.valid).toBe(false);
      expect(result.extraInfo?.spikes).toBeDefined();
      expect(Array.isArray(result.extraInfo?.spikes)).toBe(true);
      expect(result.extraInfo?.spikeCount).toBeGreaterThan(0);
    });

    it("should not detect spikes in simple polygon", async () => {
      const polygonUuid = "test-uuid";
      mockGetGeoJSONParsed.mockResolvedValue(TEST_POLYGONS.VALID_NO_SPIKES as unknown as Polygon);

      const result = await validator.validatePolygon(polygonUuid);

      expect(result.valid).toBe(true);
      expect(result.extraInfo?.spikes).toEqual([]);
      expect(result.extraInfo?.spikeCount).toBe(0);
    });
  });
});

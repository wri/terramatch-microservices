import { Test, TestingModule } from "@nestjs/testing";
import { ProjectPolygonGeometryService } from "./project-polygon-geometry.service";
import { VoronoiService } from "../voronoi/voronoi.service";
import { PolygonGeometry } from "@terramatch-microservices/database/entities";
import { InternalServerErrorException } from "@nestjs/common";
import { FeatureCollection, Feature, Point, Polygon, LineString } from "geojson";
import { QueryTypes, Transaction } from "sequelize";
import * as turf from "@turf/turf";

jest.mock("@turf/turf", () => ({
  circle: jest.fn(),
  point: jest.fn()
}));

describe("ProjectPolygonGeometryService", () => {
  let service: ProjectPolygonGeometryService;
  let voronoiService: jest.Mocked<VoronoiService>;
  let mockSequelize: { query: jest.Mock };

  beforeEach(async () => {
    const mockVoronoiService = {
      transformPointsToPolygons: jest.fn()
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectPolygonGeometryService,
        {
          provide: VoronoiService,
          useValue: mockVoronoiService
        }
      ]
    }).compile();

    service = module.get<ProjectPolygonGeometryService>(ProjectPolygonGeometryService);
    voronoiService = module.get(VoronoiService);

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
    Object.defineProperty(PolygonGeometry, "sequelize", {
      get: jest.fn(() => mockSequelize),
      configurable: true
    });
  });

  describe("transformFeaturesToSinglePolygon", () => {
    it("should throw InternalServerErrorException when feature collection is empty", async () => {
      const featureCollection: FeatureCollection = {
        type: "FeatureCollection",
        features: []
      };

      await expect(service.transformFeaturesToSinglePolygon(featureCollection)).rejects.toThrow(
        InternalServerErrorException
      );
      await expect(service.transformFeaturesToSinglePolygon(featureCollection)).rejects.toThrow(
        "No features to transform"
      );
    });

    it("should buffer single point feature with default est_area", async () => {
      const point: Point = { type: "Point", coordinates: [0, 0] };
      const featureCollection: FeatureCollection = {
        type: "FeatureCollection",
        features: [{ type: "Feature", geometry: point, properties: {} }]
      };

      const expectedPolygon: Polygon = {
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

      (turf.point as jest.Mock).mockReturnValue({ type: "Point", coordinates: [0, 0] });
      (turf.circle as jest.Mock).mockReturnValue({ geometry: expectedPolygon });

      const result = await service.transformFeaturesToSinglePolygon(featureCollection);

      expect(turf.point).toHaveBeenCalledWith([0, 0]);
      expect(turf.circle).toHaveBeenCalled();
      expect(result).toEqual(expectedPolygon);
    });

    it("should buffer single point feature with estArea property", async () => {
      const point: Point = { type: "Point", coordinates: [0, 0] };
      const featureCollection: FeatureCollection = {
        type: "FeatureCollection",
        features: [{ type: "Feature", geometry: point, properties: { estArea: 100 } }]
      };

      const expectedPolygon: Polygon = {
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

      (turf.point as jest.Mock).mockReturnValue({ type: "Point", coordinates: [0, 0] });
      (turf.circle as jest.Mock).mockReturnValue({ geometry: expectedPolygon });

      const result = await service.transformFeaturesToSinglePolygon(featureCollection);

      expect(turf.circle).toHaveBeenCalled();
      expect(result).toEqual(expectedPolygon);
    });

    it("should buffer single point feature with est_area property", async () => {
      const point: Point = { type: "Point", coordinates: [0, 0] };
      const featureCollection: FeatureCollection = {
        type: "FeatureCollection",
        features: [{ type: "Feature", geometry: point, properties: { est_area: 50 } }]
      };

      const expectedPolygon: Polygon = {
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

      (turf.point as jest.Mock).mockReturnValue({ type: "Point", coordinates: [0, 0] });
      (turf.circle as jest.Mock).mockReturnValue({ geometry: expectedPolygon });

      const result = await service.transformFeaturesToSinglePolygon(featureCollection);

      expect(turf.circle).toHaveBeenCalled();
      expect(result).toEqual(expectedPolygon);
    });

    it("should fallback to convex hull when Voronoi returns empty array", async () => {
      const point1: Point = { type: "Point", coordinates: [0, 0] };
      const point2: Point = { type: "Point", coordinates: [1, 1] };
      const featureCollection: FeatureCollection = {
        type: "FeatureCollection",
        features: [
          { type: "Feature", geometry: point1, properties: {} },
          { type: "Feature", geometry: point2, properties: {} }
        ]
      };

      const convexHullResult: Polygon = {
        type: "Polygon",
        coordinates: [
          [
            [0, 0],
            [0, 2],
            [2, 2],
            [2, 0],
            [0, 0]
          ]
        ]
      };

      voronoiService.transformPointsToPolygons.mockResolvedValue([]);
      mockSequelize.query.mockResolvedValue([{ convex_hull: JSON.stringify(convexHullResult) }]);

      const result = await service.transformFeaturesToSinglePolygon(featureCollection);

      expect(voronoiService.transformPointsToPolygons).toHaveBeenCalled();
      expect(mockSequelize.query).toHaveBeenCalled();
      expect(result).toEqual(convexHullResult);
    });

    it("should return geometry as-is for single polygon feature", async () => {
      const polygon: Polygon = {
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
      const featureCollection: FeatureCollection = {
        type: "FeatureCollection",
        features: [{ type: "Feature", geometry: polygon, properties: {} }]
      };

      const result = await service.transformFeaturesToSinglePolygon(featureCollection);

      expect(result).toEqual(polygon);
      expect(voronoiService.transformPointsToPolygons).not.toHaveBeenCalled();
      expect(mockSequelize.query).not.toHaveBeenCalled();
    });

    it("should return geometry as-is for single line feature", async () => {
      const lineString: LineString = {
        type: "LineString",
        coordinates: [
          [0, 0],
          [1, 1]
        ]
      };
      const featureCollection: FeatureCollection = {
        type: "FeatureCollection",
        features: [{ type: "Feature", geometry: lineString, properties: {} }]
      };

      const result = await service.transformFeaturesToSinglePolygon(featureCollection);

      expect(result).toEqual(lineString);
    });

    it("should compute convex hull for multiple non-point features", async () => {
      const polygon1: Polygon = {
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
      const polygon2: Polygon = {
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
      };
      const featureCollection: FeatureCollection = {
        type: "FeatureCollection",
        features: [
          { type: "Feature", geometry: polygon1, properties: {} },
          { type: "Feature", geometry: polygon2, properties: {} }
        ]
      };

      const convexHullResult: Polygon = {
        type: "Polygon",
        coordinates: [
          [
            [0, 0],
            [0, 3],
            [3, 3],
            [3, 0],
            [0, 0]
          ]
        ]
      };

      mockSequelize.query.mockResolvedValue([{ convex_hull: JSON.stringify(convexHullResult) }]);

      const result = await service.transformFeaturesToSinglePolygon(featureCollection);

      expect(mockSequelize.query).toHaveBeenCalled();
      expect(result).toEqual(convexHullResult);
    });

    it("should compute convex hull for mixed geometry types", async () => {
      const point: Point = { type: "Point", coordinates: [0, 0] };
      const polygon: Polygon = {
        type: "Polygon",
        coordinates: [
          [
            [1, 1],
            [1, 2],
            [2, 2],
            [2, 1],
            [1, 1]
          ]
        ]
      };
      const featureCollection: FeatureCollection = {
        type: "FeatureCollection",
        features: [
          { type: "Feature", geometry: point, properties: {} },
          { type: "Feature", geometry: polygon, properties: {} }
        ]
      };

      const convexHullResult: Polygon = {
        type: "Polygon",
        coordinates: [
          [
            [0, 0],
            [0, 2],
            [2, 2],
            [2, 0],
            [0, 0]
          ]
        ]
      };

      mockSequelize.query.mockResolvedValue([{ convex_hull: JSON.stringify(convexHullResult) }]);

      const result = await service.transformFeaturesToSinglePolygon(featureCollection);

      expect(mockSequelize.query).toHaveBeenCalled();
      expect(result).toEqual(convexHullResult);
    });
  });

  describe("computeConvexHull", () => {
    it("should throw InternalServerErrorException when sequelize is not available", async () => {
      Object.defineProperty(PolygonGeometry, "sequelize", {
        get: jest.fn(() => null),
        configurable: true
      });

      const features: Feature[] = [
        { type: "Feature", geometry: { type: "Point", coordinates: [0, 0] }, properties: {} }
      ];

      await expect(service.computeConvexHull(features)).rejects.toThrow(InternalServerErrorException);
      await expect(service.computeConvexHull(features)).rejects.toThrow(
        "PolygonGeometry model is missing sequelize connection"
      );
    });

    it("should throw InternalServerErrorException when features array is empty", async () => {
      await expect(service.computeConvexHull([])).rejects.toThrow(InternalServerErrorException);
      await expect(service.computeConvexHull([])).rejects.toThrow("No features provided for convex hull");
    });

    it("should return polygon as-is for single polygon feature", async () => {
      const polygon: Polygon = {
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
      const features: Feature[] = [{ type: "Feature", geometry: polygon, properties: {} }];

      const result = await service.computeConvexHull(features);

      expect(result).toEqual(polygon);
      expect(mockSequelize.query).not.toHaveBeenCalled();
    });

    it("should compute convex hull for multiple features", async () => {
      const point1: Point = { type: "Point", coordinates: [0, 0] };
      const point2: Point = { type: "Point", coordinates: [1, 1] };
      const features: Feature[] = [
        { type: "Feature", geometry: point1, properties: {} },
        { type: "Feature", geometry: point2, properties: {} }
      ];

      const convexHullResult: Polygon = {
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

      mockSequelize.query.mockResolvedValue([{ convex_hull: JSON.stringify(convexHullResult) }]);

      const result = await service.computeConvexHull(features);

      expect(mockSequelize.query).toHaveBeenCalledWith(
        expect.stringContaining("ST_ConvexHull"),
        expect.objectContaining({
          replacements: expect.objectContaining({ geojson: expect.any(String) }),
          type: QueryTypes.SELECT
        })
      );
      expect(result).toEqual(convexHullResult);
    });

    it("should pass transaction to query when provided", async () => {
      const point1: Point = { type: "Point", coordinates: [0, 0] };
      const point2: Point = { type: "Point", coordinates: [1, 1] };
      const features: Feature[] = [
        { type: "Feature", geometry: point1, properties: {} },
        { type: "Feature", geometry: point2, properties: {} }
      ];

      const mockTransaction = {} as Transaction;
      const convexHullResult: Polygon = {
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

      mockSequelize.query.mockResolvedValue([{ convex_hull: JSON.stringify(convexHullResult) }]);

      await service.computeConvexHull(features, mockTransaction);

      expect(mockSequelize.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          transaction: mockTransaction
        })
      );
    });

    it("should throw InternalServerErrorException when query returns empty results", async () => {
      const point1: Point = { type: "Point", coordinates: [0, 0] };
      const point2: Point = { type: "Point", coordinates: [1, 1] };
      const features: Feature[] = [
        { type: "Feature", geometry: point1, properties: {} },
        { type: "Feature", geometry: point2, properties: {} }
      ];

      mockSequelize.query.mockResolvedValue([]);

      await expect(service.computeConvexHull(features)).rejects.toThrow(InternalServerErrorException);
      await expect(service.computeConvexHull(features)).rejects.toThrow("Failed to compute convex hull");
    });

    it("should throw InternalServerErrorException when query returns null convex_hull", async () => {
      const point1: Point = { type: "Point", coordinates: [0, 0] };
      const point2: Point = { type: "Point", coordinates: [1, 1] };
      const features: Feature[] = [
        { type: "Feature", geometry: point1, properties: {} },
        { type: "Feature", geometry: point2, properties: {} }
      ];

      mockSequelize.query.mockResolvedValue([{ convex_hull: null }]);

      await expect(service.computeConvexHull(features)).rejects.toThrow(InternalServerErrorException);
      await expect(service.computeConvexHull(features)).rejects.toThrow("Failed to compute convex hull");
    });
  });
});

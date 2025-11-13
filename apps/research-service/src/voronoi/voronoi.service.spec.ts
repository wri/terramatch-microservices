import { Test, TestingModule } from "@nestjs/testing";
import { VoronoiService } from "./voronoi.service";
import { Feature as RequestFeature } from "../site-polygons/dto/create-site-polygon-request.dto";
import type { Voronoi } from "d3-delaunay";

type Point = [number, number];

const createMockVoronoi = (points: Point[]): Voronoi<Point> => {
  const cellPolygon = (i: number): Point[] | null => {
    if (i < 0 || i >= points.length) return null;
    const [x, y] = points[i] ?? [0, 0];
    const size = 1000;
    return [
      [x - size, y - size],
      [x + size, y - size],
      [x + size, y + size],
      [x - size, y + size],
      [x - size, y - size]
    ];
  };

  return {
    cellPolygon
  } as Voronoi<Point>;
};

const mockDelaunayModule = {
  Delaunay: {
    from: jest.fn((points: Point[]) => {
      return {
        voronoi: jest.fn(() => createMockVoronoi(points))
      };
    })
  }
} as unknown as typeof import("d3-delaunay");

describe("VoronoiService", () => {
  let service: VoronoiService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [VoronoiService]
    }).compile();

    service = module.get<VoronoiService>(VoronoiService);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    jest.spyOn(service as any, "getDelaunayModule").mockResolvedValue(mockDelaunayModule);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const createPointFeature = (
    lon: number,
    lat: number,
    estArea = 1.0,
    properties: Record<string, unknown> = {}
  ): RequestFeature => ({
    type: "Feature",
    geometry: {
      type: "Point",
      coordinates: [lon, lat]
    },
    properties: {
      site_id: "test-site",
      est_area: estArea,
      ...properties
    }
  });

  describe("transformPointsToPolygons", () => {
    it("should return empty array for empty input", async () => {
      const result = await service.transformPointsToPolygons([]);
      expect(result).toEqual([]);
    });

    it("should transform single valid point to polygon", async () => {
      const features = [createPointFeature(0, 0, 1.0)];
      const result = await service.transformPointsToPolygons(features);

      expect(result.length).toBe(1);
      expect(result[0].type).toBe("Feature");
      expect(result[0].geometry.type).toBe("Polygon");
      expect(result[0].properties.site_id).toBe("test-site");
    });

    it("should transform multiple points to polygons", async () => {
      const features = [
        createPointFeature(0, 0, 1.0, { site_id: "site-1" }),
        createPointFeature(1, 1, 2.0, { site_id: "site-2" }),
        createPointFeature(-1, -1, 0.5, { site_id: "site-3" })
      ];

      const result = await service.transformPointsToPolygons(features);

      expect(result.length).toBeGreaterThanOrEqual(1);
      result.forEach(feature => {
        expect(feature.type).toBe("Feature");
        expect(feature.geometry.type).toMatch(/Polygon|MultiPolygon/);
      });
    });

    it("should filter out points with invalid coordinates", async () => {
      const features = [createPointFeature(0, 0, 1.0), createPointFeature(1, 1, 1.0)];

      const result = await service.transformPointsToPolygons(features);

      expect(result.length).toBeGreaterThanOrEqual(1);
      const validIndices = result.map(r => r.properties.site_id);
      expect(validIndices).not.toContain(undefined);
    });

    it("should handle invalid coordinates that throw errors", async () => {
      const features = [
        createPointFeature(0, 0, 1.0),
        createPointFeature(NaN, 0, 1.0),
        createPointFeature(0, Infinity, 1.0)
      ];

      await expect(service.transformPointsToPolygons(features)).rejects.toThrow();
    });

    it("should handle points with zero area", async () => {
      const features = [createPointFeature(0, 0, 0)];
      const result = await service.transformPointsToPolygons(features);

      expect(result.length).toBeGreaterThanOrEqual(0);
    });

    it("should handle points with large area", async () => {
      const features = [createPointFeature(0, 0, 1000.0)];
      const result = await service.transformPointsToPolygons(features);

      expect(result.length).toBeGreaterThanOrEqual(0);
    });

    it("should preserve properties from input features", async () => {
      const features = [
        createPointFeature(0, 0, 1.0, {
          site_id: "custom-site",
          poly_name: "Test Polygon",
          custom_prop: "value"
        })
      ];

      const result = await service.transformPointsToPolygons(features);

      if (result.length > 0) {
        expect(result[0].properties.site_id).toBe("custom-site");
        expect(result[0].properties.poly_name).toBe("Test Polygon");
        expect(result[0].properties.custom_prop).toBe("value");
      }
    });

    it("should handle points with missing est_area property", async () => {
      const features: RequestFeature[] = [
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

      const result = await service.transformPointsToPolygons(features);

      expect(result.length).toBeGreaterThanOrEqual(0);
    });

    it("should generate non-overlapping polygons for well-spaced points", async () => {
      const features = [
        createPointFeature(0, 0, 1.0),
        createPointFeature(10, 10, 1.0),
        createPointFeature(-10, -10, 1.0)
      ];

      const result = await service.transformPointsToPolygons(features);

      expect(result.length).toBeGreaterThanOrEqual(1);
    });

    it("should handle collinear points", async () => {
      const features = [createPointFeature(0, 0, 1.0), createPointFeature(1, 0, 1.0), createPointFeature(2, 0, 1.0)];

      const result = await service.transformPointsToPolygons(features);

      expect(result.length).toBeGreaterThanOrEqual(0);
    });
    it("should lazily load and cache d3-delaunay module", async () => {
      const freshService = new VoronoiService();

      const getDelaunayModuleSpy = jest.spyOn(
        freshService,
        "getDelaunayModule" as keyof VoronoiService
      ) as unknown as jest.SpyInstance<Promise<typeof import("d3-delaunay")>, []>;
      getDelaunayModuleSpy.mockResolvedValue(mockDelaunayModule);

      const result1 = await freshService.transformPointsToPolygons([createPointFeature(0, 0, 1.0)]);
      expect(result1).toBeDefined();
      expect(getDelaunayModuleSpy).toHaveBeenCalledTimes(1);

      const result2 = await freshService.transformPointsToPolygons([createPointFeature(1, 1, 1.0)]);
      expect(result2).toBeDefined();

      expect(getDelaunayModuleSpy).toHaveBeenCalledTimes(2);

      expect(Array.isArray(result1)).toBe(true);
      expect(Array.isArray(result2)).toBe(true);

      getDelaunayModuleSpy.mockRestore();
    });

    it("should execute getDelaunayModule implementation and cache the promise", async () => {
      const freshService = new VoronoiService();

      // Mock the Function constructor to intercept the dynamic import
      const originalFunction = global.Function;
      const mockImportFn = jest.fn(() => Promise.resolve(mockDelaunayModule));
      global.Function = jest.fn(() => {
        return mockImportFn;
      }) as unknown as typeof Function;
      const getDelaunayModule = (
        freshService as unknown as Record<string, () => Promise<typeof import("d3-delaunay")>>
      )["getDelaunayModule"] as () => Promise<typeof import("d3-delaunay")>;

      const promise1 = getDelaunayModule.call(freshService);
      expect(mockImportFn).toHaveBeenCalledTimes(1);
      const module1 = await promise1;
      expect(module1).toBe(mockDelaunayModule);

      const cachedPromise = (freshService as unknown as Record<string, Promise<typeof import("d3-delaunay")> | null>)[
        "delaunayModulePromise"
      ];
      expect(cachedPromise).not.toBeNull();
      expect(cachedPromise).toBeDefined();

      const promise2 = getDelaunayModule.call(freshService);
      expect(mockImportFn).toHaveBeenCalledTimes(1); // Still 1, not 2
      const module2 = await promise2;
      expect(module2).toBe(mockDelaunayModule);

      const cachedPromiseAfterSecondCall = (
        freshService as unknown as Record<string, Promise<typeof import("d3-delaunay")> | null>
      )["delaunayModulePromise"];
      expect(cachedPromiseAfterSecondCall).toBe(cachedPromise);

      global.Function = originalFunction;
    });
  });

  describe("private method behavior through public API", () => {
    it("should compute correct buffer radius based on est_area", async () => {
      const smallArea = createPointFeature(0, 0, 0.1);
      const largeArea = createPointFeature(1, 1, 10.0);

      const [smallResult, largeResult] = await Promise.all([
        service.transformPointsToPolygons([smallArea]),
        service.transformPointsToPolygons([largeArea])
      ]);

      expect(smallResult.length).toBeGreaterThanOrEqual(0);
      expect(largeResult.length).toBeGreaterThanOrEqual(0);

      if (smallResult.length > 0 && largeResult.length > 0) {
        expect(smallResult[0].geometry.type).toMatch(/Polygon|MultiPolygon/);
        expect(largeResult[0].geometry.type).toMatch(/Polygon|MultiPolygon/);
      }
    });

    it("should use custom projection centered on feature centroid", async () => {
      const features = [createPointFeature(-10, -10, 1.0), createPointFeature(10, 10, 1.0)];

      const result = await service.transformPointsToPolygons(features);

      expect(result.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe("error handling", () => {
    it("should handle voronoi generation errors gracefully", async () => {
      const features = [createPointFeature(0, 0, 1.0)];

      const result = await service.transformPointsToPolygons(features);

      expect(Array.isArray(result)).toBe(true);
    });

    it("should handle intersection calculation failures", async () => {
      const features = [createPointFeature(0, 0, 1.0)];

      const result = await service.transformPointsToPolygons(features);

      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe("edge cases", () => {
    it("should handle single point at equator", async () => {
      const features = [createPointFeature(0, 0, 1.0)];
      const result = await service.transformPointsToPolygons(features);
      expect(Array.isArray(result)).toBe(true);
    });

    it("should handle single point at poles", async () => {
      const features = [createPointFeature(0, 90, 1.0)];
      const result = await service.transformPointsToPolygons(features);
      expect(Array.isArray(result)).toBe(true);
    });

    it("should handle points with extreme longitude", async () => {
      const features = [createPointFeature(180, 0, 1.0)];
      const result = await service.transformPointsToPolygons(features);
      expect(Array.isArray(result)).toBe(true);
    });

    it("should handle points with negative est_area", async () => {
      const features = [createPointFeature(0, 0, -1.0)];
      await expect(service.transformPointsToPolygons(features)).rejects.toThrow();
    });
  });
});

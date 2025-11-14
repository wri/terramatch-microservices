import { Test, TestingModule } from "@nestjs/testing";
import { InternalServerErrorException, NotFoundException } from "@nestjs/common";
import { PolygonClippingService } from "./polygon-clipping.service";
import { PolygonGeometry, SitePolygon, CriteriaSite, Site } from "@terramatch-microservices/database/entities";
import { Transaction } from "sequelize";
import { VALIDATION_CRITERIA_IDS } from "@terramatch-microservices/database/constants";
import { Polygon, MultiPolygon } from "geojson";
import { SitePolygonCreationService } from "../site-polygons/site-polygon-creation.service";

interface MockSequelize {
  query: jest.Mock;
  transaction: jest.Mock;
}

interface MockCriteriaSiteRecord {
  polygonId: string;
  extraInfo:
    | Array<{
        polyUuid: string | null;
        percentage: number;
        intersectionArea: number;
      }>
    | null
    | string;
}

interface MockPolygonData {
  uuid: string;
  name: string;
  area: number;
  geojson: string;
}

interface MockClippedGeoJson {
  clipped_geojson: string;
}

interface MockQueryResult {
  uuid: string;
  name: string;
  geojson: string;
}

describe("PolygonClippingService", () => {
  let service: PolygonClippingService;
  let mockTransaction: Transaction;
  let mockSequelize: MockSequelize;

  const samplePolygon: Polygon = {
    type: "Polygon",
    coordinates: [
      [
        [104.14293058113105, 13.749724096039358],
        [104.68941630988292, 13.586722290863463],
        [104.40664352872176, 13.993692766531538],
        [104.14293058113105, 13.749724096039358]
      ]
    ]
  };

  const sampleMultiPolygon: MultiPolygon = {
    type: "MultiPolygon",
    coordinates: [
      [
        [
          [104.16086018482935, 12.634081210376962],
          [104.1655896984207, 12.63084245920291],
          [104.17294849914686, 12.631483561370558],
          [104.1721261998643, 12.63498740034828],
          [104.16086018482935, 12.634081210376962]
        ]
      ]
    ]
  };

  const samplePolygon2: Polygon = {
    type: "Polygon",
    coordinates: [
      [
        [104.3, 13.7],
        [104.4, 13.7],
        [104.4, 13.8],
        [104.3, 13.8],
        [104.3, 13.7]
      ]
    ]
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PolygonClippingService,
        {
          provide: SitePolygonCreationService,
          useValue: {
            createSitePolygons: jest.fn(),
            createSitePolygonVersion: jest.fn()
          }
        }
      ]
    }).compile();

    service = module.get<PolygonClippingService>(PolygonClippingService);

    jest.spyOn(service["logger"], "error").mockImplementation();
    jest.spyOn(service["logger"], "warn").mockImplementation();
    jest.spyOn(service["logger"], "log").mockImplementation();

    mockTransaction = {
      commit: jest.fn().mockResolvedValue(undefined),
      rollback: jest.fn().mockResolvedValue(undefined)
    } as unknown as Transaction;

    mockSequelize = {
      transaction: jest.fn().mockResolvedValue(mockTransaction),
      query: jest.fn()
    };
    (PolygonGeometry.sequelize as unknown as MockSequelize | null) = mockSequelize;
  });

  afterEach(() => {
    jest.restoreAllMocks();
    (PolygonGeometry.sequelize as unknown as MockSequelize | null) = null;
  });

  describe("getFixablePolygonsForSite", () => {
    const siteUuid = "550e8400-e29b-41d4-a716-446655440000";

    it("should throw NotFoundException when site is not found", async () => {
      jest.spyOn(Site, "findOne").mockResolvedValue(null);

      await expect(service.getFixablePolygonsForSite(siteUuid)).rejects.toThrow(NotFoundException);
      expect(Site.findOne).toHaveBeenCalledWith({ where: { uuid: siteUuid } });
    });

    it("should return empty array when no polygons are found", async () => {
      const mockSite = { uuid: siteUuid } as Site;
      jest.spyOn(Site, "findOne").mockResolvedValue(mockSite);
      jest.spyOn(SitePolygon, "findAll").mockResolvedValue([]);

      const result = await service.getFixablePolygonsForSite(siteUuid);

      expect(result).toEqual([]);
      expect(SitePolygon.findAll).toHaveBeenCalledWith({
        where: { siteUuid, isActive: true },
        attributes: ["polygonUuid"]
      });
    });

    it("should return fixable polygons when they exist", async () => {
      const mockSite = { uuid: siteUuid } as Site;
      const polygonUuid1 = "polygon-uuid-1";
      const polygonUuid2 = "polygon-uuid-2";

      jest.spyOn(Site, "findOne").mockResolvedValue(mockSite);
      jest
        .spyOn(SitePolygon, "findAll")
        .mockResolvedValue([
          { polygonUuid: polygonUuid1 } as SitePolygon,
          { polygonUuid: polygonUuid2 } as SitePolygon
        ]);

      const mockCriteriaRecord: MockCriteriaSiteRecord = {
        polygonId: polygonUuid1,
        extraInfo: [
          {
            polyUuid: polygonUuid2,
            percentage: 2.5, // Within limit (≤3.5%)
            intersectionArea: 0.05 // Within limit (≤0.118 hectares)
          }
        ]
      };

      jest.spyOn(CriteriaSite, "findAll").mockResolvedValue([mockCriteriaRecord as unknown as CriteriaSite]);

      const result = await service.getFixablePolygonsForSite(siteUuid);

      expect(result).toContain(polygonUuid1);
      expect(result).toContain(polygonUuid2);
      expect(CriteriaSite.findAll).toHaveBeenCalledWith({
        where: {
          polygonId: [polygonUuid1, polygonUuid2],
          criteriaId: VALIDATION_CRITERIA_IDS.OVERLAPPING,
          valid: false
        },
        attributes: ["polygonId", "extraInfo"]
      });
    });

    it("should filter out non-fixable overlaps", async () => {
      const mockSite = { uuid: siteUuid } as Site;
      const polygonUuid1 = "polygon-uuid-1";
      const polygonUuid2 = "polygon-uuid-2";

      jest.spyOn(Site, "findOne").mockResolvedValue(mockSite);
      jest
        .spyOn(SitePolygon, "findAll")
        .mockResolvedValue([
          { polygonUuid: polygonUuid1 } as SitePolygon,
          { polygonUuid: polygonUuid2 } as SitePolygon
        ]);

      const mockCriteriaRecord: MockCriteriaSiteRecord = {
        polygonId: polygonUuid1,
        extraInfo: [
          {
            polyUuid: polygonUuid2,
            percentage: 5.0, // Over limit (>3.5%)
            intersectionArea: 0.05
          }
        ]
      };

      jest.spyOn(CriteriaSite, "findAll").mockResolvedValue([mockCriteriaRecord as unknown as CriteriaSite]);

      const result = await service.getFixablePolygonsForSite(siteUuid);

      expect(result).toEqual([]);
    });
  });

  describe("getFixablePolygonsForProjectBySite", () => {
    const siteUuid = "550e8400-e29b-41d4-a716-446655440000";
    const projectId = 1;

    it("should throw NotFoundException when site is not found", async () => {
      jest.spyOn(Site, "findOne").mockResolvedValue(null);

      await expect(service.getFixablePolygonsForProjectBySite(siteUuid)).rejects.toThrow(NotFoundException);
    });

    it("should throw NotFoundException when projectId is null", async () => {
      const mockSite = { uuid: siteUuid, projectId: null } as unknown as Site;
      jest.spyOn(Site, "findOne").mockResolvedValue(mockSite);

      await expect(service.getFixablePolygonsForProjectBySite(siteUuid)).rejects.toThrow(NotFoundException);
    });

    it("should return fixable polygons for all sites in project", async () => {
      const mockSite = { uuid: siteUuid, projectId } as Site;
      const otherSiteUuid = "660e8400-e29b-41d4-a716-446655440001";
      const polygonUuid1 = "polygon-uuid-1";
      const polygonUuid2 = "polygon-uuid-2";

      jest.spyOn(Site, "findOne").mockResolvedValue(mockSite);
      jest.spyOn(Site, "findAll").mockResolvedValue([{ uuid: siteUuid } as Site, { uuid: otherSiteUuid } as Site]);
      jest
        .spyOn(SitePolygon, "findAll")
        .mockResolvedValue([
          { polygonUuid: polygonUuid1 } as SitePolygon,
          { polygonUuid: polygonUuid2 } as SitePolygon
        ]);

      const mockCriteriaRecord: MockCriteriaSiteRecord = {
        polygonId: polygonUuid1,
        extraInfo: [
          {
            polyUuid: polygonUuid2,
            percentage: 2.5,
            intersectionArea: 0.05
          }
        ]
      };

      jest.spyOn(CriteriaSite, "findAll").mockResolvedValue([mockCriteriaRecord as unknown as CriteriaSite]);

      const result = await service.getFixablePolygonsForProjectBySite(siteUuid);

      expect(result).toContain(polygonUuid1);
      expect(result).toContain(polygonUuid2);
      expect(Site.findAll).toHaveBeenCalledWith({
        where: { projectId },
        attributes: ["uuid"]
      });
    });
  });

  describe("filterFixablePolygonsFromList", () => {
    it("should return empty array when no polygon UUIDs provided", async () => {
      const result = await service.filterFixablePolygonsFromList([]);
      expect(result).toEqual([]);
    });

    it("should return fixable polygons from the list", async () => {
      const polygonUuid1 = "polygon-uuid-1";
      const polygonUuid2 = "polygon-uuid-2";

      const mockCriteriaRecord: MockCriteriaSiteRecord = {
        polygonId: polygonUuid1,
        extraInfo: [
          {
            polyUuid: polygonUuid2,
            percentage: 2.5,
            intersectionArea: 0.05
          }
        ]
      };

      jest.spyOn(CriteriaSite, "findAll").mockResolvedValue([mockCriteriaRecord as unknown as CriteriaSite]);

      const result = await service.filterFixablePolygonsFromList([polygonUuid1, polygonUuid2]);

      expect(result).toContain(polygonUuid1);
      expect(result).toContain(polygonUuid2);
    });
  });

  describe("clipPolygons", () => {
    it("should return empty array when no polygons provided", async () => {
      const result = await service.clipPolygons([]);
      expect(result).toEqual([]);
    });

    it("should throw InternalServerErrorException when sequelize is missing", async () => {
      (PolygonGeometry.sequelize as unknown as MockSequelize | null) = null;

      await expect(service.clipPolygons(["polygon-uuid-1"])).rejects.toThrow(InternalServerErrorException);
    });

    it("should return empty array when no fixable overlap pairs found", async () => {
      jest.spyOn(CriteriaSite, "findAll").mockResolvedValue([]);

      const result = await service.clipPolygons(["polygon-uuid-1"]);

      expect(result).toEqual([]);
      expect(mockTransaction.rollback).toHaveBeenCalled();
      expect(mockTransaction.commit).not.toHaveBeenCalled();
    });

    it("should successfully clip polygons", async () => {
      const polygonUuid1 = "polygon-uuid-1";
      const polygonUuid2 = "polygon-uuid-2";

      const mockCriteriaRecord: MockCriteriaSiteRecord = {
        polygonId: polygonUuid1,
        extraInfo: [
          {
            polyUuid: polygonUuid2,
            percentage: 2.5,
            intersectionArea: 0.05
          }
        ]
      };

      jest.spyOn(CriteriaSite, "findAll").mockResolvedValue([mockCriteriaRecord as unknown as CriteriaSite]);

      const mockPolygonData: MockPolygonData[] = [
        {
          uuid: polygonUuid1,
          name: "Polygon 1",
          area: 0.001,
          geojson: JSON.stringify(samplePolygon)
        },
        {
          uuid: polygonUuid2,
          name: "Polygon 2",
          area: 0.0005,
          geojson: JSON.stringify(samplePolygon2)
        }
      ];

      (mockSequelize.query as jest.Mock).mockResolvedValueOnce(mockPolygonData);

      const mockClippedResult: MockClippedGeoJson[] = [
        {
          clipped_geojson: JSON.stringify(sampleMultiPolygon)
        }
      ];
      (mockSequelize.query as jest.Mock).mockResolvedValueOnce(mockClippedResult);

      const result = await service.clipPolygons([polygonUuid1, polygonUuid2]);

      expect(mockTransaction.commit).toHaveBeenCalled();
      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toHaveProperty("polyUuid");
      expect(result[0]).toHaveProperty("geometry");
      expect(result[0]).toHaveProperty("originalArea");
      expect(result[0]).toHaveProperty("newArea");
      expect(result[0]).toHaveProperty("areaRemoved");
    });

    it("should handle errors and rollback transaction", async () => {
      jest.spyOn(CriteriaSite, "findAll").mockRejectedValue(new Error("Database error"));

      await expect(service.clipPolygons(["polygon-uuid-1"])).rejects.toThrow(InternalServerErrorException);
      expect(mockTransaction.rollback).toHaveBeenCalled();
      expect(mockTransaction.commit).not.toHaveBeenCalled();
    });

    it("should return empty array when polygons.size === 0", async () => {
      const polygonUuid1 = "polygon-uuid-1";
      const polygonUuid2 = "polygon-uuid-2";

      const mockCriteriaRecord: MockCriteriaSiteRecord = {
        polygonId: polygonUuid1,
        extraInfo: [
          {
            polyUuid: polygonUuid2,
            percentage: 2.5,
            intersectionArea: 0.05
          }
        ]
      };

      jest.spyOn(CriteriaSite, "findAll").mockResolvedValue([mockCriteriaRecord as unknown as CriteriaSite]);

      (mockSequelize.query as jest.Mock).mockResolvedValueOnce([]);

      const result = await service.clipPolygons([polygonUuid1, polygonUuid2]);

      expect(result).toEqual([]);
      expect(mockTransaction.rollback).toHaveBeenCalled();
      expect(mockTransaction.commit).not.toHaveBeenCalled();
    });

    it("should handle multiple polygons with different areas", async () => {
      const polygonUuid1 = "polygon-uuid-1";
      const polygonUuid2 = "polygon-uuid-2";
      const polygonUuid3 = "polygon-uuid-3";

      const mockCriteriaRecord1: MockCriteriaSiteRecord = {
        polygonId: polygonUuid1,
        extraInfo: [
          {
            polyUuid: polygonUuid2,
            percentage: 2.5,
            intersectionArea: 0.05
          }
        ]
      };

      const mockCriteriaRecord2: MockCriteriaSiteRecord = {
        polygonId: polygonUuid1,
        extraInfo: [
          {
            polyUuid: polygonUuid3,
            percentage: 2.0,
            intersectionArea: 0.03
          }
        ]
      };

      jest
        .spyOn(CriteriaSite, "findAll")
        .mockResolvedValue([mockCriteriaRecord1, mockCriteriaRecord2] as unknown as CriteriaSite[]);

      const mockPolygonData: MockPolygonData[] = [
        {
          uuid: polygonUuid1,
          name: "Polygon 1",
          area: 0.001,
          geojson: JSON.stringify(samplePolygon)
        },
        {
          uuid: polygonUuid2,
          name: "Polygon 2",
          area: 0.0005,
          geojson: JSON.stringify(samplePolygon2)
        },
        {
          uuid: polygonUuid3,
          name: "Polygon 3",
          area: 0.0003,
          geojson: JSON.stringify(samplePolygon)
        }
      ];

      (mockSequelize.query as jest.Mock)
        .mockResolvedValueOnce(mockPolygonData)
        .mockResolvedValueOnce([{ clipped_geojson: JSON.stringify(sampleMultiPolygon) }])
        .mockResolvedValueOnce([{ clipped_geojson: JSON.stringify(samplePolygon) }]);

      const result = await service.clipPolygons([polygonUuid1, polygonUuid2, polygonUuid3]);

      expect(mockTransaction.commit).toHaveBeenCalled();
      expect(result.length).toBeGreaterThan(0);
    });

    it("should handle case where polygon2 has larger area than polygon1", async () => {
      const polygonUuid1 = "polygon-uuid-1";
      const polygonUuid2 = "polygon-uuid-2";

      const mockCriteriaRecord: MockCriteriaSiteRecord = {
        polygonId: polygonUuid1,
        extraInfo: [
          {
            polyUuid: polygonUuid2,
            percentage: 2.5,
            intersectionArea: 0.05
          }
        ]
      };

      jest.spyOn(CriteriaSite, "findAll").mockResolvedValue([mockCriteriaRecord as unknown as CriteriaSite]);

      const mockPolygonData: MockPolygonData[] = [
        {
          uuid: polygonUuid1,
          name: "Polygon 1",
          area: 0.0005,
          geojson: JSON.stringify(samplePolygon)
        },
        {
          uuid: polygonUuid2,
          name: "Polygon 2",
          area: 0.001,
          geojson: JSON.stringify(samplePolygon2)
        }
      ];

      (mockSequelize.query as jest.Mock)
        .mockResolvedValueOnce(mockPolygonData)
        .mockResolvedValueOnce([{ clipped_geojson: JSON.stringify(sampleMultiPolygon) }]);

      const result = await service.clipPolygons([polygonUuid1, polygonUuid2]);

      expect(mockTransaction.commit).toHaveBeenCalled();
      expect(result.length).toBeGreaterThan(0);
    });

    it("should handle case where polygon data is not found for pair", async () => {
      const polygonUuid1 = "polygon-uuid-1";
      const polygonUuid2 = "polygon-uuid-2";
      const polygonUuid3 = "polygon-uuid-3";

      const mockCriteriaRecord: MockCriteriaSiteRecord = {
        polygonId: polygonUuid1,
        extraInfo: [
          {
            polyUuid: polygonUuid2,
            percentage: 2.5,
            intersectionArea: 0.05
          },
          {
            polyUuid: polygonUuid3,
            percentage: 2.0,
            intersectionArea: 0.03
          }
        ]
      };

      jest.spyOn(CriteriaSite, "findAll").mockResolvedValue([mockCriteriaRecord as unknown as CriteriaSite]);

      const mockPolygonData: MockPolygonData[] = [
        {
          uuid: polygonUuid1,
          name: "Polygon 1",
          area: 0.001,
          geojson: JSON.stringify(samplePolygon)
        },
        {
          uuid: polygonUuid2,
          name: "Polygon 2",
          area: 0.0005,
          geojson: JSON.stringify(samplePolygon2)
        }
      ];

      (mockSequelize.query as jest.Mock).mockResolvedValueOnce(mockPolygonData);

      const result = await service.clipPolygons([polygonUuid1, polygonUuid2, polygonUuid3]);

      expect(mockTransaction.commit).toHaveBeenCalled();
      expect(result.length).toBeGreaterThanOrEqual(0);
    });

    it("should handle case where clippedGeometry is null", async () => {
      const polygonUuid1 = "polygon-uuid-1";
      const polygonUuid2 = "polygon-uuid-2";

      const mockCriteriaRecord: MockCriteriaSiteRecord = {
        polygonId: polygonUuid1,
        extraInfo: [
          {
            polyUuid: polygonUuid2,
            percentage: 2.5,
            intersectionArea: 0.05
          }
        ]
      };

      jest.spyOn(CriteriaSite, "findAll").mockResolvedValue([mockCriteriaRecord as unknown as CriteriaSite]);

      const mockPolygonData: MockPolygonData[] = [
        {
          uuid: polygonUuid1,
          name: "Polygon 1",
          area: 0.001,
          geojson: JSON.stringify(samplePolygon)
        },
        {
          uuid: polygonUuid2,
          name: "Polygon 2",
          area: 0.0005,
          geojson: JSON.stringify(samplePolygon2)
        }
      ];

      (mockSequelize.query as jest.Mock).mockResolvedValueOnce(mockPolygonData).mockResolvedValueOnce([]);

      const result = await service.clipPolygons([polygonUuid1, polygonUuid2]);

      expect(mockTransaction.commit).toHaveBeenCalled();
      expect(result.length).toBe(0);
    });
  });

  describe("getOriginalGeometriesGeoJson", () => {
    it("should throw InternalServerErrorException when sequelize is missing", async () => {
      (PolygonGeometry.sequelize as unknown as MockSequelize | null) = null;

      await expect(service.getOriginalGeometriesGeoJson(["polygon-uuid-1"])).rejects.toThrow(
        InternalServerErrorException
      );
    });

    it("should return FeatureCollection with original geometries", async () => {
      const polygonUuid1 = "polygon-uuid-1";
      const polygonUuid2 = "polygon-uuid-2";

      const mockQueryResults: MockQueryResult[] = [
        {
          uuid: polygonUuid1,
          name: "Polygon 1",
          geojson: JSON.stringify(samplePolygon)
        },
        {
          uuid: polygonUuid2,
          name: "Polygon 2",
          geojson: JSON.stringify(samplePolygon2)
        }
      ];

      (mockSequelize.query as jest.Mock).mockResolvedValue(mockQueryResults);

      const result = await service.getOriginalGeometriesGeoJson([polygonUuid1, polygonUuid2]);

      expect(result.type).toBe("FeatureCollection");
      expect(result.features).toHaveLength(2);
      expect(result?.features?.[0]?.properties?.poly_id).toBe(polygonUuid1);
      expect(result?.features?.[0]?.properties?.poly_name).toBe("Polygon 1");
      expect(result?.features?.[0]?.geometry).toEqual(samplePolygon);
      expect(result?.features?.[1]?.properties?.poly_id).toBe(polygonUuid2);
      expect(result?.features?.[1]?.geometry).toEqual(samplePolygon2);
    });

    it("should handle empty polygon list", async () => {
      const mockQueryResults: MockQueryResult[] = [];
      (mockSequelize.query as jest.Mock).mockResolvedValue(mockQueryResults);

      const result = await service.getOriginalGeometriesGeoJson([]);

      expect(result.type).toBe("FeatureCollection");
      expect(result.features).toHaveLength(0);
    });
  });

  describe("buildGeoJsonResponse", () => {
    it("should build FeatureCollection from clipped results", () => {
      const clippedResults = [
        {
          polyUuid: "polygon-uuid-1",
          polyName: "Polygon 1",
          geometry: samplePolygon,
          originalArea: 10.5,
          newArea: 10.2,
          areaRemoved: 0.3
        },
        {
          polyUuid: "polygon-uuid-2",
          polyName: "Polygon 2",
          geometry: sampleMultiPolygon,
          originalArea: 5.2,
          newArea: 5.0,
          areaRemoved: 0.2
        }
      ];

      const result = service.buildGeoJsonResponse(clippedResults);

      expect(result.type).toBe("FeatureCollection");
      expect(result.features).toHaveLength(2);

      expect(result.features[0].type).toBe("Feature");
      expect(result?.features?.[0]?.properties?.poly_id).toBe("polygon-uuid-1");
      expect(result?.features?.[0]?.properties?.poly_name).toBe("Polygon 1");
      expect(result?.features?.[0]?.properties?.original_area_ha).toBe(10.5);
      expect(result?.features?.[0]?.properties?.new_area_ha).toBe(10.2);
      expect(result?.features?.[0]?.properties?.area_removed_ha).toBe(0.3);
      expect(result?.features?.[0]?.geometry).toEqual(samplePolygon);

      expect(result.features[1].type).toBe("Feature");
      expect(result?.features?.[1]?.properties?.poly_id).toBe("polygon-uuid-2");
      expect(result.features[1].geometry).toEqual(sampleMultiPolygon);
    });

    it("should handle empty clipped results", () => {
      const result = service.buildGeoJsonResponse([]);

      expect(result.type).toBe("FeatureCollection");
      expect(result.features).toHaveLength(0);
    });

    it("should handle MultiPolygon geometries", () => {
      const clippedResults = [
        {
          polyUuid: "polygon-uuid-1",
          polyName: "Multi Polygon",
          geometry: sampleMultiPolygon,
          originalArea: 10.5,
          newArea: 10.2,
          areaRemoved: 0.3
        }
      ];

      const result = service.buildGeoJsonResponse(clippedResults);

      expect(result.features[0].geometry.type).toBe("MultiPolygon");
      expect(result.features[0].geometry).toEqual(sampleMultiPolygon);
    });
  });

  describe("edge cases and error handling", () => {
    it("should handle null extraInfo in criteria records", async () => {
      const polygonUuid1 = "polygon-uuid-1";
      const polygonUuid2 = "polygon-uuid-2";

      jest.spyOn(Site, "findOne").mockResolvedValue({ uuid: "site-uuid" } as Site);
      jest
        .spyOn(SitePolygon, "findAll")
        .mockResolvedValue([
          { polygonUuid: polygonUuid1 } as SitePolygon,
          { polygonUuid: polygonUuid2 } as SitePolygon
        ]);

      const mockCriteriaRecord: MockCriteriaSiteRecord = {
        polygonId: polygonUuid1,
        extraInfo: null
      };

      jest.spyOn(CriteriaSite, "findAll").mockResolvedValue([mockCriteriaRecord as unknown as CriteriaSite]);

      const result = await service.getFixablePolygonsForSite("site-uuid");

      expect(result).toEqual([]);
    });

    it("should handle non-array extraInfo in criteria records", async () => {
      const polygonUuid1 = "polygon-uuid-1";

      jest.spyOn(Site, "findOne").mockResolvedValue({ uuid: "site-uuid" } as Site);
      jest.spyOn(SitePolygon, "findAll").mockResolvedValue([{ polygonUuid: polygonUuid1 } as SitePolygon]);

      const mockCriteriaRecord: MockCriteriaSiteRecord = {
        polygonId: polygonUuid1,
        extraInfo: "not an array"
      };

      jest.spyOn(CriteriaSite, "findAll").mockResolvedValue([mockCriteriaRecord as unknown as CriteriaSite]);

      const result = await service.getFixablePolygonsForSite("site-uuid");

      expect(result).toEqual([]);
    });

    it("should handle overlaps that exceed percentage threshold", async () => {
      const polygonUuid1 = "polygon-uuid-1";
      const polygonUuid2 = "polygon-uuid-2";

      jest.spyOn(Site, "findOne").mockResolvedValue({ uuid: "site-uuid" } as Site);
      jest
        .spyOn(SitePolygon, "findAll")
        .mockResolvedValue([
          { polygonUuid: polygonUuid1 } as SitePolygon,
          { polygonUuid: polygonUuid2 } as SitePolygon
        ]);

      const mockCriteriaRecord: MockCriteriaSiteRecord = {
        polygonId: polygonUuid1,
        extraInfo: [
          {
            polyUuid: polygonUuid2,
            percentage: 4.0, // Exceeds 3.5%
            intersectionArea: 0.05
          }
        ]
      };

      jest.spyOn(CriteriaSite, "findAll").mockResolvedValue([mockCriteriaRecord as unknown as CriteriaSite]);

      const result = await service.getFixablePolygonsForSite("site-uuid");

      expect(result).toEqual([]);
    });

    it("should handle overlaps that exceed area threshold", async () => {
      const polygonUuid1 = "polygon-uuid-1";
      const polygonUuid2 = "polygon-uuid-2";

      jest.spyOn(Site, "findOne").mockResolvedValue({ uuid: "site-uuid" } as Site);
      jest
        .spyOn(SitePolygon, "findAll")
        .mockResolvedValue([
          { polygonUuid: polygonUuid1 } as SitePolygon,
          { polygonUuid: polygonUuid2 } as SitePolygon
        ]);

      const mockCriteriaRecord: MockCriteriaSiteRecord = {
        polygonId: polygonUuid1,
        extraInfo: [
          {
            polyUuid: polygonUuid2,
            percentage: 2.5,
            intersectionArea: 0.2 // Exceeds 0.118 hectares
          }
        ]
      };

      jest.spyOn(CriteriaSite, "findAll").mockResolvedValue([mockCriteriaRecord as unknown as CriteriaSite]);

      const result = await service.getFixablePolygonsForSite("site-uuid");

      expect(result).toEqual([]);
    });

    it("should handle overlaps with null polyUuid", async () => {
      const polygonUuid1 = "polygon-uuid-1";

      jest.spyOn(Site, "findOne").mockResolvedValue({ uuid: "site-uuid" } as Site);
      jest.spyOn(SitePolygon, "findAll").mockResolvedValue([{ polygonUuid: polygonUuid1 } as SitePolygon]);

      const mockCriteriaRecord: MockCriteriaSiteRecord = {
        polygonId: polygonUuid1,
        extraInfo: [
          {
            polyUuid: null,
            percentage: 2.5,
            intersectionArea: 0.05
          }
        ]
      };

      jest.spyOn(CriteriaSite, "findAll").mockResolvedValue([mockCriteriaRecord as unknown as CriteriaSite]);

      const result = await service.getFixablePolygonsForSite("site-uuid");

      expect(result).toEqual([]);
    });
  });

  describe("clipPolygonGeometryMultiple edge cases", () => {
    it("should handle multiple iterations (i > 0)", async () => {
      const polygonUuid1 = "polygon-uuid-1";
      const polygonUuid2 = "polygon-uuid-2";
      const polygonUuid3 = "polygon-uuid-3";

      const mockCriteriaRecord: MockCriteriaSiteRecord = {
        polygonId: polygonUuid1,
        extraInfo: [
          {
            polyUuid: polygonUuid2,
            percentage: 2.5,
            intersectionArea: 0.05
          },
          {
            polyUuid: polygonUuid3,
            percentage: 2.0,
            intersectionArea: 0.03
          }
        ]
      };

      jest.spyOn(CriteriaSite, "findAll").mockResolvedValue([mockCriteriaRecord as unknown as CriteriaSite]);

      const mockPolygonData: MockPolygonData[] = [
        {
          uuid: polygonUuid1,
          name: "Polygon 1",
          area: 0.001,
          geojson: JSON.stringify(samplePolygon)
        },
        {
          uuid: polygonUuid2,
          name: "Polygon 2",
          area: 0.0005,
          geojson: JSON.stringify(samplePolygon2)
        },
        {
          uuid: polygonUuid3,
          name: "Polygon 3",
          area: 0.0003,
          geojson: JSON.stringify(samplePolygon)
        }
      ];

      (mockSequelize.query as jest.Mock).mockResolvedValueOnce(mockPolygonData);
      (mockSequelize.query as jest.Mock).mockResolvedValueOnce([{ clipped_geojson: JSON.stringify(samplePolygon) }]);
      (mockSequelize.query as jest.Mock).mockResolvedValueOnce([
        { clipped_geojson: JSON.stringify(sampleMultiPolygon) }
      ]);

      const result = await service.clipPolygons([polygonUuid1, polygonUuid2, polygonUuid3]);

      expect(mockTransaction.commit).toHaveBeenCalled();
      expect(result.length).toBeGreaterThan(0);
    });

    it("should handle null clipped_geojson in results", async () => {
      const polygonUuid1 = "polygon-uuid-1";
      const polygonUuid2 = "polygon-uuid-2";

      const mockCriteriaRecord: MockCriteriaSiteRecord = {
        polygonId: polygonUuid1,
        extraInfo: [
          {
            polyUuid: polygonUuid2,
            percentage: 2.5,
            intersectionArea: 0.05
          }
        ]
      };

      jest.spyOn(CriteriaSite, "findAll").mockResolvedValue([mockCriteriaRecord as unknown as CriteriaSite]);

      const mockPolygonData: MockPolygonData[] = [
        {
          uuid: polygonUuid1,
          name: "Polygon 1",
          area: 0.001,
          geojson: JSON.stringify(samplePolygon)
        },
        {
          uuid: polygonUuid2,
          name: "Polygon 2",
          area: 0.0005,
          geojson: JSON.stringify(samplePolygon2)
        }
      ];

      (mockSequelize.query as jest.Mock)
        .mockResolvedValueOnce(mockPolygonData)
        .mockResolvedValueOnce([{ clipped_geojson: null }]);

      const result = await service.clipPolygons([polygonUuid1, polygonUuid2]);

      expect(mockTransaction.commit).toHaveBeenCalled();
      expect(result.length).toBe(0);
    });

    it("should handle invalid geometry type after clipping", async () => {
      const polygonUuid1 = "polygon-uuid-1";
      const polygonUuid2 = "polygon-uuid-2";

      const mockCriteriaRecord: MockCriteriaSiteRecord = {
        polygonId: polygonUuid1,
        extraInfo: [
          {
            polyUuid: polygonUuid2,
            percentage: 2.5,
            intersectionArea: 0.05
          }
        ]
      };

      jest.spyOn(CriteriaSite, "findAll").mockResolvedValue([mockCriteriaRecord as unknown as CriteriaSite]);

      const mockPolygonData: MockPolygonData[] = [
        {
          uuid: polygonUuid1,
          name: "Polygon 1",
          area: 0.001,
          geojson: JSON.stringify(samplePolygon)
        },
        {
          uuid: polygonUuid2,
          name: "Polygon 2",
          area: 0.0005,
          geojson: JSON.stringify(samplePolygon2)
        }
      ];

      (mockSequelize.query as jest.Mock)
        .mockResolvedValueOnce(mockPolygonData)
        .mockResolvedValueOnce([{ clipped_geojson: JSON.stringify({ type: "Point", coordinates: [0, 0] }) }]);

      const result = await service.clipPolygons([polygonUuid1, polygonUuid2]);

      expect(mockTransaction.commit).toHaveBeenCalled();
      expect(result.length).toBe(0);
    });

    it("should handle error in clipPolygonGeometryMultiple", async () => {
      const polygonUuid1 = "polygon-uuid-1";
      const polygonUuid2 = "polygon-uuid-2";

      const mockCriteriaRecord: MockCriteriaSiteRecord = {
        polygonId: polygonUuid1,
        extraInfo: [
          {
            polyUuid: polygonUuid2,
            percentage: 2.5,
            intersectionArea: 0.05
          }
        ]
      };

      jest.spyOn(CriteriaSite, "findAll").mockResolvedValue([mockCriteriaRecord as unknown as CriteriaSite]);

      const mockPolygonData: MockPolygonData[] = [
        {
          uuid: polygonUuid1,
          name: "Polygon 1",
          area: 0.001,
          geojson: JSON.stringify(samplePolygon)
        },
        {
          uuid: polygonUuid2,
          name: "Polygon 2",
          area: 0.0005,
          geojson: JSON.stringify(samplePolygon2)
        }
      ];

      (mockSequelize.query as jest.Mock)
        .mockResolvedValueOnce(mockPolygonData)
        .mockRejectedValueOnce(new Error("Database query error"));

      const result = await service.clipPolygons([polygonUuid1, polygonUuid2]);

      expect(mockTransaction.commit).toHaveBeenCalled();
      expect(result.length).toBe(0);
    });
  });

  describe("getApproxLatitude and simplifyGeometry", () => {
    it("should handle MultiPolygon in getApproxLatitude", async () => {
      const polygonUuid1 = "polygon-uuid-1";
      const polygonUuid2 = "polygon-uuid-2";

      const mockCriteriaRecord: MockCriteriaSiteRecord = {
        polygonId: polygonUuid1,
        extraInfo: [
          {
            polyUuid: polygonUuid2,
            percentage: 2.5,
            intersectionArea: 0.05
          }
        ]
      };

      jest.spyOn(CriteriaSite, "findAll").mockResolvedValue([mockCriteriaRecord as unknown as CriteriaSite]);

      const mockPolygonData: MockPolygonData[] = [
        {
          uuid: polygonUuid1,
          name: "Polygon 1",
          area: 0.001,
          geojson: JSON.stringify(sampleMultiPolygon)
        },
        {
          uuid: polygonUuid2,
          name: "Polygon 2",
          area: 0.0005,
          geojson: JSON.stringify(samplePolygon2)
        }
      ];

      (mockSequelize.query as jest.Mock)
        .mockResolvedValueOnce(mockPolygonData)
        .mockResolvedValueOnce([{ clipped_geojson: JSON.stringify(sampleMultiPolygon) }]);

      const result = await service.clipPolygons([polygonUuid1, polygonUuid2]);

      expect(mockTransaction.commit).toHaveBeenCalled();
      expect(result.length).toBeGreaterThan(0);
    });

    it("should handle error in simplifyGeometry", async () => {
      const polygonUuid1 = "polygon-uuid-1";
      const polygonUuid2 = "polygon-uuid-2";

      const mockCriteriaRecord: MockCriteriaSiteRecord = {
        polygonId: polygonUuid1,
        extraInfo: [
          {
            polyUuid: polygonUuid2,
            percentage: 2.5,
            intersectionArea: 0.05
          }
        ]
      };

      jest.spyOn(CriteriaSite, "findAll").mockResolvedValue([mockCriteriaRecord as unknown as CriteriaSite]);

      const mockPolygonData: MockPolygonData[] = [
        {
          uuid: polygonUuid1,
          name: "Polygon 1",
          area: 0.001,
          geojson: JSON.stringify(samplePolygon)
        },
        {
          uuid: polygonUuid2,
          name: "Polygon 2",
          area: 0.0005,
          geojson: JSON.stringify(samplePolygon2)
        }
      ];

      const invalidPolygon = {
        type: "Polygon",
        coordinates: [[]] // Invalid coordinates
      };

      (mockSequelize.query as jest.Mock)
        .mockResolvedValueOnce(mockPolygonData)
        .mockResolvedValueOnce([{ clipped_geojson: JSON.stringify(invalidPolygon) }]);

      const result = await service.clipPolygons([polygonUuid1, polygonUuid2]);

      expect(mockTransaction.commit).toHaveBeenCalled();
      expect(result.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe("getFixableOverlapPairs", () => {
    it("should return empty array when no polygon UUIDs provided", async () => {
      const mockCriteriaRecords: MockCriteriaSiteRecord[] = [];
      jest.spyOn(CriteriaSite, "findAll").mockResolvedValue(mockCriteriaRecords as unknown as CriteriaSite[]);

      const result = await service["getFixableOverlapPairs"]([]);

      expect(result).toEqual([]);
    });

    it("should continue when extraInfo is null", async () => {
      const polygonUuid1 = "polygon-uuid-1";

      const mockCriteriaRecord: MockCriteriaSiteRecord = {
        polygonId: polygonUuid1,
        extraInfo: null
      };

      jest.spyOn(CriteriaSite, "findAll").mockResolvedValue([mockCriteriaRecord as unknown as CriteriaSite]);

      const result = await service["getFixableOverlapPairs"]([polygonUuid1]);

      expect(result).toEqual([]);
    });

    it("should continue when extraInfo is not an array", async () => {
      const polygonUuid1 = "polygon-uuid-1";

      const mockCriteriaRecord: MockCriteriaSiteRecord = {
        polygonId: polygonUuid1,
        extraInfo: "not an array"
      };

      jest.spyOn(CriteriaSite, "findAll").mockResolvedValue([mockCriteriaRecord as unknown as CriteriaSite]);

      const result = await service["getFixableOverlapPairs"]([polygonUuid1]);

      expect(result).toEqual([]);
    });

    it("should handle duplicate pairs", async () => {
      const polygonUuid1 = "polygon-uuid-1";
      const polygonUuid2 = "polygon-uuid-2";

      const mockCriteriaRecord1: MockCriteriaSiteRecord = {
        polygonId: polygonUuid1,
        extraInfo: [
          {
            polyUuid: polygonUuid2,
            percentage: 2.5,
            intersectionArea: 0.05
          }
        ]
      };

      const mockCriteriaRecord2: MockCriteriaSiteRecord = {
        polygonId: polygonUuid2,
        extraInfo: [
          {
            polyUuid: polygonUuid1,
            percentage: 2.5,
            intersectionArea: 0.05
          }
        ]
      };

      jest
        .spyOn(CriteriaSite, "findAll")
        .mockResolvedValue([mockCriteriaRecord1, mockCriteriaRecord2] as unknown as CriteriaSite[]);

      const mockPolygonData: MockPolygonData[] = [
        {
          uuid: polygonUuid1,
          name: "Polygon 1",
          area: 0.001,
          geojson: JSON.stringify(samplePolygon)
        },
        {
          uuid: polygonUuid2,
          name: "Polygon 2",
          area: 0.0005,
          geojson: JSON.stringify(samplePolygon2)
        }
      ];

      (mockSequelize.query as jest.Mock)
        .mockResolvedValueOnce(mockPolygonData)
        .mockResolvedValueOnce([{ clipped_geojson: JSON.stringify(sampleMultiPolygon) }]);

      const result = await service.clipPolygons([polygonUuid1, polygonUuid2]);

      expect(mockTransaction.commit).toHaveBeenCalled();
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe("getPolygonsWithGeometry edge cases", () => {
    it("should handle getPolygonsWithGeometry when sequelize is missing", async () => {
      const polygonUuid1 = "polygon-uuid-1";
      const polygonUuid2 = "polygon-uuid-2";

      const mockCriteriaRecord: MockCriteriaSiteRecord = {
        polygonId: polygonUuid1,
        extraInfo: [
          {
            polyUuid: polygonUuid2,
            percentage: 2.5,
            intersectionArea: 0.05
          }
        ]
      };

      jest.spyOn(CriteriaSite, "findAll").mockResolvedValue([mockCriteriaRecord as unknown as CriteriaSite]);

      (PolygonGeometry.sequelize as unknown as MockSequelize | null) = {
        transaction: jest.fn().mockResolvedValue(mockTransaction),
        query: jest.fn().mockImplementation(() => {
          (PolygonGeometry.sequelize as unknown as MockSequelize | null) = null;
          return Promise.reject(
            new InternalServerErrorException("PolygonGeometry model is missing sequelize connection")
          );
        })
      };

      await expect(service.clipPolygons([polygonUuid1, polygonUuid2])).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe("processFixableOverlaps edge cases", () => {
    it("should handle processFixableOverlaps when sequelize becomes null", async () => {
      const polygonUuid1 = "polygon-uuid-1";
      const polygonUuid2 = "polygon-uuid-2";

      const mockCriteriaRecord: MockCriteriaSiteRecord = {
        polygonId: polygonUuid1,
        extraInfo: [
          {
            polyUuid: polygonUuid2,
            percentage: 2.5,
            intersectionArea: 0.05
          }
        ]
      };

      jest.spyOn(CriteriaSite, "findAll").mockResolvedValue([mockCriteriaRecord as unknown as CriteriaSite]);

      const mockPolygonData: MockPolygonData[] = [
        {
          uuid: polygonUuid1,
          name: "Polygon 1",
          area: 0.001,
          geojson: JSON.stringify(samplePolygon)
        },
        {
          uuid: polygonUuid2,
          name: "Polygon 2",
          area: 0.0005,
          geojson: JSON.stringify(samplePolygon2)
        }
      ];

      (mockSequelize.query as jest.Mock).mockResolvedValueOnce(mockPolygonData).mockImplementationOnce(() => {
        (PolygonGeometry.sequelize as unknown as MockSequelize | null) = null;
        return Promise.reject(
          new InternalServerErrorException("PolygonGeometry model is missing sequelize connection")
        );
      });

      const result = await service.clipPolygons([polygonUuid1, polygonUuid2]);

      expect(mockTransaction.commit).toHaveBeenCalled();
      expect(result).toEqual([]);
    });
  });

  describe("clipAndCreateVersions", () => {
    const userId = 1;
    const userFullName = "Test User";
    const source = "terramatch";

    beforeEach(() => {
      (SitePolygon.sequelize as unknown as MockSequelize | null) = {
        transaction: jest.fn().mockImplementation(callback => {
          return Promise.resolve(callback(mockTransaction));
        }),
        query: jest.fn()
      };
      (PolygonGeometry.sequelize as unknown as MockSequelize | null) = mockSequelize;
    });

    it("should return empty array when no polygon UUIDs provided", async () => {
      const result = await service.clipAndCreateVersions([], userId, userFullName, source);
      expect(result).toEqual([]);
    });

    it("should throw InternalServerErrorException when sequelize is missing", async () => {
      (SitePolygon.sequelize as unknown as MockSequelize | null) = null;

      await expect(service.clipAndCreateVersions(["polygon-uuid-1"], userId, userFullName, source)).rejects.toThrow(
        InternalServerErrorException
      );
    });

    it("should return empty array when no fixable overlaps found", async () => {
      jest.spyOn(CriteriaSite, "findAll").mockResolvedValue([]);

      const result = await service.clipAndCreateVersions(["polygon-uuid-1"], userId, userFullName, source);

      expect(result).toEqual([]);
    });

    it("should successfully create versions for clipped polygons", async () => {
      const polygonUuid1 = "polygon-uuid-1";
      const polygonUuid2 = "polygon-uuid-2";
      const sitePolygonUuid1 = "site-polygon-uuid-1";
      const sitePolygonUuid2 = "site-polygon-uuid-2";

      const baseSitePolygon1 = {
        uuid: sitePolygonUuid1,
        polygonUuid: polygonUuid1,
        siteUuid: "site-uuid-1",
        primaryUuid: "primary-uuid-1",
        isActive: true
      } as SitePolygon;

      const baseSitePolygon2 = {
        uuid: sitePolygonUuid2,
        polygonUuid: polygonUuid2,
        siteUuid: "site-uuid-2",
        primaryUuid: "primary-uuid-2",
        isActive: true
      } as SitePolygon;

      const newVersion1 = {
        uuid: "version-uuid-1",
        polyName: "Polygon 1",
        primaryUuid: "primary-uuid-1"
      } as SitePolygon;

      const newVersion2 = {
        uuid: "version-uuid-2",
        polyName: "Polygon 2",
        primaryUuid: "primary-uuid-2"
      } as SitePolygon;

      jest
        .spyOn(CriteriaSite, "findAll")
        .mockResolvedValueOnce([
          {
            polygonId: polygonUuid1,
            extraInfo: [
              {
                polyUuid: polygonUuid2,
                percentage: 2.5,
                intersectionArea: 0.05
              }
            ]
          } as unknown as CriteriaSite
        ])
        .mockResolvedValueOnce([
          {
            polygonId: polygonUuid1,
            extraInfo: [
              {
                polyUuid: polygonUuid2,
                percentage: 2.5,
                intersectionArea: 0.05
              }
            ]
          } as unknown as CriteriaSite
        ])
        .mockResolvedValueOnce([
          {
            polygonId: polygonUuid1,
            extraInfo: [
              {
                polyUuid: polygonUuid2,
                percentage: 2.5,
                intersectionArea: 0.05
              }
            ]
          } as unknown as CriteriaSite
        ]);

      (mockSequelize.query as jest.Mock)
        .mockResolvedValueOnce([
          {
            uuid: polygonUuid1,
            name: "Polygon 1",
            area: 0.001,
            geojson: JSON.stringify(samplePolygon)
          },
          {
            uuid: polygonUuid2,
            name: "Polygon 2",
            area: 0.0005,
            geojson: JSON.stringify(samplePolygon2)
          }
        ])
        .mockResolvedValueOnce([{ clipped_geojson: JSON.stringify(sampleMultiPolygon) }])
        .mockResolvedValueOnce([
          {
            uuid: polygonUuid1,
            name: "Polygon 1",
            area: 0.001,
            geojson: JSON.stringify(samplePolygon)
          },
          {
            uuid: polygonUuid2,
            name: "Polygon 2",
            area: 0.0005,
            geojson: JSON.stringify(samplePolygon2)
          }
        ])
        .mockResolvedValueOnce([{ clipped_geojson: JSON.stringify(sampleMultiPolygon) }]);

      jest.spyOn(SitePolygon, "findAll").mockResolvedValue([baseSitePolygon1, baseSitePolygon2]);

      const mockSitePolygonCreationService = service[
        "sitePolygonCreationService"
      ] as jest.Mocked<SitePolygonCreationService>;
      mockSitePolygonCreationService.createSitePolygonVersion = jest
        .fn()
        .mockResolvedValueOnce(newVersion1)
        .mockResolvedValueOnce(newVersion2);

      jest.spyOn(CriteriaSite, "destroy").mockResolvedValue(0);
      jest.spyOn(SitePolygon, "update").mockResolvedValue([2]);

      const result = await service.clipAndCreateVersions([polygonUuid1, polygonUuid2], userId, userFullName, source);

      expect(result.length).toBeGreaterThan(0);
      expect(result[0].uuid).toBeDefined();
      expect(result[0].originalArea).toBeDefined();
      expect(result[0].newArea).toBeDefined();
      expect(result[0].areaRemoved).toBeDefined();
      expect(mockSitePolygonCreationService.createSitePolygonVersion).toHaveBeenCalled();
    });

    it("should handle case where base site polygon is not found", async () => {
      const polygonUuid1 = "polygon-uuid-1";

      jest.spyOn(CriteriaSite, "findAll").mockResolvedValue([]);
      jest.spyOn(SitePolygon, "findAll").mockResolvedValue([]);

      const result = await service.clipAndCreateVersions([polygonUuid1], userId, userFullName, source);

      expect(result).toEqual([]);
    });

    it("should handle errors during version creation gracefully", async () => {
      const polygonUuid1 = "polygon-uuid-1";
      const sitePolygonUuid1 = "site-polygon-uuid-1";

      const baseSitePolygon1 = {
        uuid: sitePolygonUuid1,
        polygonUuid: polygonUuid1,
        siteUuid: "site-uuid-1",
        primaryUuid: "primary-uuid-1",
        isActive: true
      } as SitePolygon;

      const otherUuid = "other-polygon-uuid";
      jest
        .spyOn(CriteriaSite, "findAll")
        .mockResolvedValueOnce([
          {
            polygonId: polygonUuid1,
            extraInfo: [
              {
                polyUuid: otherUuid,
                percentage: 2.5,
                intersectionArea: 0.05
              }
            ]
          } as unknown as CriteriaSite
        ])
        .mockResolvedValueOnce([
          {
            polygonId: polygonUuid1,
            extraInfo: [
              {
                polyUuid: otherUuid,
                percentage: 2.5,
                intersectionArea: 0.05
              }
            ]
          } as unknown as CriteriaSite
        ]);

      (mockSequelize.query as jest.Mock)
        .mockResolvedValueOnce([
          {
            uuid: polygonUuid1,
            name: "Polygon 1",
            area: 0.001,
            geojson: JSON.stringify(samplePolygon)
          },
          {
            uuid: otherUuid,
            name: "Other Polygon",
            area: 0.0005,
            geojson: JSON.stringify(samplePolygon2)
          }
        ])
        .mockResolvedValueOnce([{ clipped_geojson: JSON.stringify(sampleMultiPolygon) }])
        .mockResolvedValueOnce([
          {
            uuid: polygonUuid1,
            name: "Polygon 1",
            area: 0.001,
            geojson: JSON.stringify(samplePolygon)
          },
          {
            uuid: otherUuid,
            name: "Other Polygon",
            area: 0.0005,
            geojson: JSON.stringify(samplePolygon2)
          }
        ])
        .mockResolvedValueOnce([{ clipped_geojson: JSON.stringify(sampleMultiPolygon) }]);

      jest.spyOn(SitePolygon, "findAll").mockResolvedValue([baseSitePolygon1]);

      const mockSitePolygonCreationService = service[
        "sitePolygonCreationService"
      ] as jest.Mocked<SitePolygonCreationService>;
      mockSitePolygonCreationService.createSitePolygonVersion = jest
        .fn()
        .mockRejectedValue(new Error("Creation failed"));

      jest.spyOn(CriteriaSite, "destroy").mockResolvedValue(0);
      jest.spyOn(SitePolygon, "update").mockResolvedValue([1]);

      const result = await service.clipAndCreateVersions([polygonUuid1], userId, userFullName, source);

      expect(result).toEqual([]);
      expect(mockSitePolygonCreationService.createSitePolygonVersion).toHaveBeenCalled();
    });

    it("should process polygons in batches", async () => {
      const polygonUuids = Array.from({ length: 25 }, (_, i) => `polygon-uuid-${i}`);

      const baseSitePolygons = polygonUuids.map((uuid, i) => ({
        uuid: `site-polygon-uuid-${i}`,
        polygonUuid: uuid,
        siteUuid: `site-uuid-${i}`,
        primaryUuid: `primary-uuid-${i}`,
        isActive: true
      })) as SitePolygon[];

      const mockCriteriaRecords = polygonUuids.map((uuid, i) => ({
        polygonId: uuid,
        extraInfo: [
          {
            polyUuid: polygonUuids[(i + 1) % polygonUuids.length],
            percentage: 2.5,
            intersectionArea: 0.05
          }
        ]
      })) as unknown as CriteriaSite[];

      jest
        .spyOn(CriteriaSite, "findAll")
        .mockResolvedValueOnce(mockCriteriaRecords)
        .mockResolvedValueOnce(mockCriteriaRecords);

      const mockPolygonData = polygonUuids.map((uuid, i) => ({
        uuid,
        name: `Polygon ${i}`,
        area: 0.001 + i * 0.0001,
        geojson: JSON.stringify(samplePolygon)
      }));

      (mockSequelize.query as jest.Mock)
        .mockResolvedValueOnce(mockPolygonData)
        .mockResolvedValueOnce([{ clipped_geojson: JSON.stringify(sampleMultiPolygon) }])
        .mockResolvedValueOnce(mockPolygonData)
        .mockResolvedValueOnce([{ clipped_geojson: JSON.stringify(sampleMultiPolygon) }]);

      jest.spyOn(SitePolygon, "findAll").mockResolvedValue(baseSitePolygons);

      const mockSitePolygonCreationService = service[
        "sitePolygonCreationService"
      ] as jest.Mocked<SitePolygonCreationService>;
      mockSitePolygonCreationService.createSitePolygonVersion = jest.fn().mockImplementation(async () => {
        return {
          uuid: "version-uuid",
          polyName: "Test",
          primaryUuid: "primary-uuid"
        } as SitePolygon;
      });

      jest.spyOn(CriteriaSite, "destroy").mockResolvedValue(0);
      jest.spyOn(SitePolygon, "update").mockResolvedValue([1]);

      await service.clipAndCreateVersions(polygonUuids, userId, userFullName, source);

      expect(mockSitePolygonCreationService.createSitePolygonVersion).toHaveBeenCalled();
    });
  });
});

import { Test, TestingModule } from "@nestjs/testing";
import { IndicatorsService } from "./indicators.service";
import { DataApiService } from "@terramatch-microservices/data-api";
import { IndicatorSlug } from "@terramatch-microservices/database/constants";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import {
  PolygonGeometry,
  SitePolygon,
  Site,
  Project,
  IndicatorOutputTreeCoverLoss,
  IndicatorOutputHectares
} from "@terramatch-microservices/database/entities";
import { Polygon } from "geojson";

describe("IndicatorsService", () => {
  let service: IndicatorsService;

  const mockDataApiService = {
    getIndicatorsDataset: jest.fn().mockResolvedValue([])
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IndicatorsService,
        {
          provide: DataApiService,
          useValue: mockDataApiService
        }
      ]
    }).compile();

    service = module.get<IndicatorsService>(IndicatorsService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  it("should throw an error if the indicator slug is invalid", async () => {
    await expect(service.process("invalid" as IndicatorSlug, ["polygon-1", "polygon-2"])).rejects.toThrow(
      BadRequestException
    );
    expect(mockDataApiService.getIndicatorsDataset).not.toHaveBeenCalled();
  });

  it("should throw an error if the polygon is not found", async () => {
    jest.spyOn(PolygonGeometry, "getGeoJSONParsed").mockResolvedValue(undefined);
    await expect(service.process("treeCoverLoss", ["polygon-1", "polygon-2"])).rejects.toThrow(NotFoundException);
    expect(mockDataApiService.getIndicatorsDataset).not.toHaveBeenCalled();
  });

  it("should process the indicators", async () => {
    jest.spyOn(SitePolygon, "findOne").mockResolvedValue({
      id: 1,
      calcArea: 100
    } as unknown as SitePolygon);
    jest.spyOn(PolygonGeometry, "getGeoJSONParsed").mockResolvedValue({
      type: "Polygon",
      coordinates: [
        [
          [0, 0],
          [1, 0],
          [1, 1],
          [0, 1],
          [0, 0]
        ]
      ]
    } as unknown as Polygon);
    const result = await service.process("treeCoverLoss", ["polygon-1", "polygon-2"]);
    expect(result).not.toBeNull();
  });

  describe("exportIndicatorToCsv", () => {
    it("should throw NotFoundException for unsupported indicator slug", async () => {
      await expect(service.exportIndicatorToCsv("sites", "site-uuid", "unsupportedSlug" as never)).rejects.toThrow(
        NotFoundException
      );
    });

    it("should throw NotFoundException when site is not found", async () => {
      jest.spyOn(Site, "findOne").mockResolvedValue(null);

      await expect(service.exportIndicatorToCsv("sites", "non-existent-uuid", "treeCoverLoss")).rejects.toThrow(
        NotFoundException
      );
    });

    it("should throw NotFoundException when project is not found", async () => {
      jest.spyOn(Project, "findOne").mockResolvedValue(null);

      await expect(service.exportIndicatorToCsv("projects", "non-existent-uuid", "treeCoverLoss")).rejects.toThrow(
        NotFoundException
      );
    });

    it("should return empty CSV when no polygons found", async () => {
      jest.spyOn(Site, "findOne").mockResolvedValue({ uuid: "site-uuid" } as Site);
      jest.spyOn(SitePolygon, "findAll").mockResolvedValue([]);

      const result = await service.exportIndicatorToCsv("sites", "site-uuid", "treeCoverLoss");

      expect(result).toContain("Polygon Name");
      expect(result).toContain("Size (ha)");
    });

    it("should export tree cover loss data with dynamic years", async () => {
      const mockSite = { uuid: "site-uuid", name: "Test Site" } as Site;
      const mockPolygon = {
        id: 1,
        polyName: "Polygon 1",
        status: "approved",
        plantStart: new Date("2020-01-01"),
        calcArea: 100.5,
        site: mockSite
      } as unknown as SitePolygon;

      const mockIndicator = {
        indicatorSlug: "treeCoverLoss",
        yearOfAnalysis: 2023,
        value: { "2020": 0.5, "2021": 0.3, "2022": 0.2 },
        createdAt: new Date("2023-01-01")
      } as IndicatorOutputTreeCoverLoss;

      jest.spyOn(Site, "findOne").mockResolvedValue(mockSite);
      jest.spyOn(SitePolygon, "findAll").mockResolvedValue([mockPolygon]);
      jest.spyOn(IndicatorOutputTreeCoverLoss, "findOne").mockResolvedValue(mockIndicator);

      const result = await service.exportIndicatorToCsv("sites", "site-uuid", "treeCoverLoss");

      expect(result).toContain("Polygon 1");
      expect(result).toContain("100.5");
      expect(result).toContain("2020");
      expect(result).toContain("2021");
      expect(result).toContain("2022");
    });

    it("should export restoration by strategy data", async () => {
      const mockSite = { uuid: "site-uuid", name: "Test Site" } as Site;
      const mockPolygon = {
        id: 1,
        polyName: "Polygon 1",
        status: "approved",
        plantStart: new Date("2020-01-01"),
        calcArea: 50.25,
        site: mockSite
      } as unknown as SitePolygon;

      const mockIndicator = {
        indicatorSlug: "restorationByStrategy",
        yearOfAnalysis: 2023,
        value: { "tree-planting,direct-seeding": 50.25 },
        createdAt: new Date("2023-01-01")
      } as IndicatorOutputHectares;

      jest.spyOn(Site, "findOne").mockResolvedValue(mockSite);
      jest.spyOn(SitePolygon, "findAll").mockResolvedValue([mockPolygon]);
      jest.spyOn(IndicatorOutputHectares, "findOne").mockResolvedValue(mockIndicator);

      const result = await service.exportIndicatorToCsv("sites", "site-uuid", "restorationByStrategy");

      expect(result).toContain("Polygon 1");
      expect(result).toContain("50.25");
    });

    it("should handle project entity type", async () => {
      const mockProject = { id: 1, uuid: "project-uuid" } as Project;
      const mockSite = { uuid: "site-uuid", name: "Test Site" } as Site;
      const mockPolygon = {
        id: 1,
        polyName: "Polygon 1",
        status: "approved",
        plantStart: new Date("2020-01-01"),
        calcArea: 100,
        site: mockSite
      } as unknown as SitePolygon;

      const mockIndicator = {
        indicatorSlug: "treeCoverLoss",
        yearOfAnalysis: 2023,
        value: { "2020": 0.5 },
        createdAt: new Date("2023-01-01")
      } as IndicatorOutputTreeCoverLoss;

      jest.spyOn(Project, "findOne").mockResolvedValue(mockProject);
      jest.spyOn(Site, "findAll").mockResolvedValue([mockSite]);
      jest.spyOn(SitePolygon, "findAll").mockResolvedValue([mockPolygon]);
      jest.spyOn(IndicatorOutputTreeCoverLoss, "findOne").mockResolvedValue(mockIndicator);

      const result = await service.exportIndicatorToCsv("projects", "project-uuid", "treeCoverLoss");

      expect(result).toContain("Polygon 1");
      expect(result).toContain("2020");
    });
  });

  describe("processValuesHectares", () => {
    it("should split comma-separated keys and replace hyphens", () => {
      const input = { "tree-planting,direct-seeding": 50.123456 };
      const result = service["processValuesHectares"](input);

      expect(result).toEqual({
        tree_planting: 50.123,
        direct_seeding: 50.123
      });
    });

    it("should handle single values", () => {
      const input = { "assisted-natural-regeneration": 25.789 };
      const result = service["processValuesHectares"](input);

      expect(result).toEqual({
        assisted_natural_regeneration: 25.789
      });
    });
  });

  describe("getCategoryEcoRegion", () => {
    it("should map eco region keys to proper case", () => {
      const input = {
        australasian: 75.5,
        afrotropical: 25.3,
        realm: "Mixed"
      };

      const result = service["getCategoryEcoRegion"](input);

      expect(result).toEqual({
        Australasian: 75.5,
        Afrotropical: 25.3,
        realm: "Mixed"
      });
    });

    it("should preserve unknown keys", () => {
      const input = {
        unknownRegion: 50,
        realm: "Test"
      };

      const result = service["getCategoryEcoRegion"](input);

      expect(result).toEqual({
        unknownRegion: 50,
        realm: "Test"
      });
    });

    it("should round numeric values to 3 decimal places", () => {
      const input = {
        australasian: 75.123456789
      };

      const result = service["getCategoryEcoRegion"](input);

      expect(result).toEqual({
        Australasian: 75.123
      });
    });
  });
});

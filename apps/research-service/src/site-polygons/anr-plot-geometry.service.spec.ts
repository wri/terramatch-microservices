import { Test, TestingModule } from "@nestjs/testing";
import { BadRequestException, InternalServerErrorException, NotFoundException } from "@nestjs/common";
import { AnrPlotGeometryService } from "./anr-plot-geometry.service";
import { AnrPlotGeometry, SitePolygon } from "@terramatch-microservices/database/entities";
import { FeatureCollection } from "geojson";

jest.mock("@terramatch-microservices/database/entities", () => {
  const mockTransaction = {};
  return {
    AnrPlotGeometry: {
      findOne: jest.fn(),
      destroy: jest.fn(),
      create: jest.fn(),
      sequelize: {
        transaction: jest
          .fn()
          .mockImplementation((callback: (t: typeof mockTransaction) => Promise<unknown>) => callback(mockTransaction))
      }
    },
    SitePolygon: {
      findOne: jest.fn()
    }
  };
});

describe("AnrPlotGeometryService", () => {
  let service: AnrPlotGeometryService;

  const mockPlot: Pick<AnrPlotGeometry, "id" | "uuid" | "sitePolygonUuid" | "geojson" | "plotCount" | "createdBy"> = {
    id: 1,
    uuid: "plot-uuid-123",
    sitePolygonUuid: "site-polygon-uuid",
    geojson: { type: "FeatureCollection", features: [] },
    plotCount: 5,
    createdBy: 10
  };

  const featureCollection: FeatureCollection = {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        geometry: { type: "Point", coordinates: [0, 0] },
        properties: { plot_id: 1 }
      }
    ]
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AnrPlotGeometryService]
    }).compile();

    service = module.get<AnrPlotGeometryService>(AnrPlotGeometryService);
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("assertSitePolygonEligibleForAnrPlotGeometry", () => {
    it("should throw when status is not approved", () => {
      const sitePolygon = {
        status: "draft",
        practice: ["assisted-natural-regeneration"]
      } as SitePolygon;

      expect(() => service.assertSitePolygonEligibleForAnrPlotGeometry(sitePolygon)).toThrow(BadRequestException);
      expect(() => service.assertSitePolygonEligibleForAnrPlotGeometry(sitePolygon)).toThrow(
        "ANR monitoring plots are only available for site polygons with approved status."
      );
    });

    it("should throw when practice does not include assisted-natural-regeneration", () => {
      const sitePolygon = {
        status: "approved",
        practice: ["tree-planting"]
      } as SitePolygon;

      expect(() => service.assertSitePolygonEligibleForAnrPlotGeometry(sitePolygon)).toThrow(BadRequestException);
      expect(() => service.assertSitePolygonEligibleForAnrPlotGeometry(sitePolygon)).toThrow(
        "ANR monitoring plots require the assisted-natural-regeneration restoration practice on the site polygon."
      );
    });

    it("should throw when practice is null", () => {
      const sitePolygon = { status: "approved", practice: null } as SitePolygon;

      expect(() => service.assertSitePolygonEligibleForAnrPlotGeometry(sitePolygon)).toThrow(BadRequestException);
    });

    it("should not throw when approved and practice includes assisted-natural-regeneration", () => {
      const sitePolygon = {
        status: "approved",
        practice: ["tree-planting", "assisted-natural-regeneration"]
      } as SitePolygon;

      expect(() => service.assertSitePolygonEligibleForAnrPlotGeometry(sitePolygon)).not.toThrow();
    });
  });

  describe("requireSitePolygonEligibleForAnrPlots", () => {
    it("should throw NotFoundException when site polygon is missing", async () => {
      (SitePolygon.findOne as jest.Mock).mockResolvedValue(null);

      await expect(service.requireSitePolygonEligibleForAnrPlots("missing-uuid")).rejects.toThrow(NotFoundException);
      await expect(service.requireSitePolygonEligibleForAnrPlots("missing-uuid")).rejects.toThrow(
        "Site polygon not found: missing-uuid"
      );
    });

    it("should throw BadRequestException when site polygon is not eligible", async () => {
      (SitePolygon.findOne as jest.Mock).mockResolvedValue({
        uuid: "sp-1",
        status: "submitted",
        practice: ["assisted-natural-regeneration"]
      } as SitePolygon);

      await expect(service.requireSitePolygonEligibleForAnrPlots("sp-1")).rejects.toThrow(BadRequestException);
    });

    it("should return site polygon when eligible", async () => {
      const eligible = {
        uuid: "sp-1",
        status: "approved",
        practice: ["assisted-natural-regeneration"]
      } as SitePolygon;
      (SitePolygon.findOne as jest.Mock).mockResolvedValue(eligible);

      const result = await service.requireSitePolygonEligibleForAnrPlots("sp-1");

      expect(SitePolygon.findOne).toHaveBeenCalledWith({ where: { uuid: "sp-1" } });
      expect(result).toBe(eligible);
    });
  });

  describe("getPlot", () => {
    it("should return plot when found for site polygon", async () => {
      (AnrPlotGeometry.findOne as jest.Mock).mockResolvedValue(mockPlot as AnrPlotGeometry);

      const result = await service.getPlot("site-polygon-uuid");

      expect(AnrPlotGeometry.findOne).toHaveBeenCalledWith({
        where: { sitePolygonUuid: "site-polygon-uuid" }
      });
      expect(result).toEqual(mockPlot);
    });

    it("should return null when no plot exists for site polygon", async () => {
      (AnrPlotGeometry.findOne as jest.Mock).mockResolvedValue(null);

      const result = await service.getPlot("non-existent-uuid");

      expect(AnrPlotGeometry.findOne).toHaveBeenCalledWith({
        where: { sitePolygonUuid: "non-existent-uuid" }
      });
      expect(result).toBeNull();
    });
  });

  describe("getPlotOrThrow", () => {
    it("should return plot when found", async () => {
      (AnrPlotGeometry.findOne as jest.Mock).mockResolvedValue(mockPlot as AnrPlotGeometry);

      const result = await service.getPlotOrThrow("site-polygon-uuid");

      expect(AnrPlotGeometry.findOne).toHaveBeenCalledWith({
        where: { sitePolygonUuid: "site-polygon-uuid" }
      });
      expect(result).toEqual(mockPlot);
    });

    it("should throw NotFoundException when plot not found", async () => {
      (AnrPlotGeometry.findOne as jest.Mock).mockResolvedValue(null);

      await expect(service.getPlotOrThrow("non-existent-uuid")).rejects.toThrow(NotFoundException);
      await expect(service.getPlotOrThrow("non-existent-uuid")).rejects.toThrow(
        "No ANR plot geometry found for polygon non-existent-uuid"
      );
    });
  });

  describe("upsertPlot", () => {
    it("should throw InternalServerErrorException when sequelize is null", async () => {
      const originalSequelize = AnrPlotGeometry.sequelize;
      Object.defineProperty(AnrPlotGeometry, "sequelize", {
        value: null,
        writable: true,
        configurable: true
      });

      await expect(service.upsertPlot("site-polygon-uuid", featureCollection, 1)).rejects.toThrow(
        InternalServerErrorException
      );
      await expect(service.upsertPlot("site-polygon-uuid", featureCollection, 1)).rejects.toThrow(
        "Database connection not available"
      );

      Object.defineProperty(AnrPlotGeometry, "sequelize", {
        value: originalSequelize,
        writable: true,
        configurable: true
      });
    });

    it("should destroy existing plot and create new one within transaction", async () => {
      (AnrPlotGeometry.destroy as jest.Mock).mockResolvedValue(1);
      (AnrPlotGeometry.create as jest.Mock).mockResolvedValue(mockPlot);

      const result = await service.upsertPlot("site-polygon-uuid", featureCollection, 10);

      expect(AnrPlotGeometry.sequelize?.transaction).toHaveBeenCalled();
      expect(AnrPlotGeometry.destroy).toHaveBeenCalledWith({
        where: { sitePolygonUuid: "site-polygon-uuid" },
        transaction: {}
      });
      expect(AnrPlotGeometry.create).toHaveBeenCalledWith(
        expect.objectContaining({
          sitePolygonUuid: "site-polygon-uuid",
          plotCount: 1,
          createdBy: 10
        }),
        { transaction: {} }
      );
      expect(result).toEqual(mockPlot);
    });
  });

  describe("deletePlot", () => {
    it("should call destroy with site polygon uuid", async () => {
      (AnrPlotGeometry.destroy as jest.Mock).mockResolvedValue(1);

      await service.deletePlot("site-polygon-uuid");

      expect(AnrPlotGeometry.destroy).toHaveBeenCalledWith({
        where: { sitePolygonUuid: "site-polygon-uuid" }
      });
    });
  });
});

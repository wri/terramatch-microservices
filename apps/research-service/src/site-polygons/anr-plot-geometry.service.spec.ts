import { Test, TestingModule } from "@nestjs/testing";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { AnrPlotGeometryService } from "./anr-plot-geometry.service";
import { AnrPlotGeometry, SitePolygon } from "@terramatch-microservices/database/entities";
import { FeatureCollection } from "geojson";

jest.mock("@terramatch-microservices/database/entities", () => {
  const mockTransaction = {};
  const mockTransactionFn = jest
    .fn()
    .mockImplementation((callback: (t: typeof mockTransaction) => Promise<unknown>) => callback(mockTransaction));

  const AnrPlotGeometry = {
    findOne: jest.fn(),
    destroy: jest.fn(),
    create: jest.fn()
  };

  Object.defineProperty(AnrPlotGeometry, "sql", {
    get() {
      return { transaction: mockTransactionFn };
    },
    configurable: true
  });

  return {
    AnrPlotGeometry,
    SitePolygon: {
      findOne: jest.fn()
    }
  };
});

describe("AnrPlotGeometryService", () => {
  let service: AnrPlotGeometryService;

  const sitePolygonId = 42;

  const mockPlot: Pick<AnrPlotGeometry, "id" | "uuid" | "sitePolygonId" | "geojson" | "plotCount" | "createdBy"> = {
    id: 1,
    uuid: "plot-uuid-123",
    sitePolygonId,
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

      const result = await service.getPlot(sitePolygonId);

      expect(AnrPlotGeometry.findOne).toHaveBeenCalledWith({
        where: { sitePolygonId }
      });
      expect(result).toEqual(mockPlot);
    });

    it("should return null when no plot exists for site polygon", async () => {
      (AnrPlotGeometry.findOne as jest.Mock).mockResolvedValue(null);

      const result = await service.getPlot(999);

      expect(AnrPlotGeometry.findOne).toHaveBeenCalledWith({
        where: { sitePolygonId: 999 }
      });
      expect(result).toBeNull();
    });
  });

  describe("requirePlot", () => {
    it("should return plot when found", async () => {
      (AnrPlotGeometry.findOne as jest.Mock).mockResolvedValue(mockPlot as AnrPlotGeometry);

      const result = await service.requirePlot(sitePolygonId);

      expect(AnrPlotGeometry.findOne).toHaveBeenCalledWith({
        where: { sitePolygonId }
      });
      expect(result).toEqual(mockPlot);
    });

    it("should throw NotFoundException when plot not found", async () => {
      (AnrPlotGeometry.findOne as jest.Mock).mockResolvedValue(null);

      await expect(service.requirePlot(999)).rejects.toThrow(NotFoundException);
      await expect(service.requirePlot(999)).rejects.toThrow("No ANR plot geometry found for site polygon id 999");
    });
  });

  describe("upsertPlot", () => {
    it("should destroy existing plot and create new one within transaction", async () => {
      (AnrPlotGeometry.destroy as jest.Mock).mockResolvedValue(1);
      (AnrPlotGeometry.create as jest.Mock).mockResolvedValue(mockPlot);

      const result = await service.upsertPlot(sitePolygonId, featureCollection, 10);

      expect(AnrPlotGeometry.sql.transaction).toHaveBeenCalled();
      expect(AnrPlotGeometry.destroy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { sitePolygonId }
        })
      );
      expect(AnrPlotGeometry.create).toHaveBeenCalledWith(
        expect.objectContaining({
          sitePolygonId,
          plotCount: 1,
          createdBy: 10
        }),
        expect.objectContaining({ transaction: expect.anything() })
      );
      expect(result).toEqual(mockPlot);
    });
  });

  describe("deletePlot", () => {
    it("should call destroy with site polygon id", async () => {
      (AnrPlotGeometry.destroy as jest.Mock).mockResolvedValue(1);

      await service.deletePlot(sitePolygonId);

      expect(AnrPlotGeometry.destroy).toHaveBeenCalledWith({
        where: { sitePolygonId }
      });
    });
  });
});

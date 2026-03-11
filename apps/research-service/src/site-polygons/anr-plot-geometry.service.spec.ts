import { Test, TestingModule } from "@nestjs/testing";
import { InternalServerErrorException } from "@nestjs/common";
import { AnrPlotGeometryService } from "./anr-plot-geometry.service";
import { AnrPlotGeometry } from "@terramatch-microservices/database/entities";
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

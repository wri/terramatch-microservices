import { Test, TestingModule } from "@nestjs/testing";
import { BadRequestException, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { createMock, DeepMocked } from "@golevelup/ts-jest";
import { AnrPlotGeometryController } from "./anr-plot-geometry.controller";
import { AnrPlotGeometryService } from "./anr-plot-geometry.service";
import { GeometryFileProcessingService } from "./geometry-file-processing.service";
import { PolicyService } from "@terramatch-microservices/common";
import { AnrPlotGeometry, SitePolygon } from "@terramatch-microservices/database/entities";
import { serialize } from "@terramatch-microservices/common/util/testing";
import { FeatureCollection } from "geojson";
import { Readable } from "stream";

jest.mock("@terramatch-microservices/database/entities", () => {
  const original = jest.requireActual("@terramatch-microservices/database/entities");
  return {
    ...original,
    SitePolygon: { findOne: jest.fn() },
    AnrPlotGeometry: {}
  };
});

describe("AnrPlotGeometryController", () => {
  let controller: AnrPlotGeometryController;
  let anrPlotGeometryService: DeepMocked<AnrPlotGeometryService>;
  let geometryFileProcessingService: DeepMocked<GeometryFileProcessingService>;
  let policyService: DeepMocked<PolicyService>;

  const sitePolygonUuid = "site-polygon-uuid-123";

  const mockPlot = {
    id: 1,
    uuid: "plot-uuid-123",
    sitePolygonUuid,
    geojson: { type: "FeatureCollection" as const, features: [] },
    plotCount: 5,
    createdBy: 10
  };

  const mockSitePolygon = {
    id: 1,
    uuid: sitePolygonUuid,
    siteUuid: "site-uuid"
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

  const createMockFile = (): Express.Multer.File => ({
    fieldname: "file",
    originalname: "plots.geojson",
    encoding: "7bit",
    mimetype: "application/geo+json",
    size: 100,
    buffer: Buffer.from(JSON.stringify(featureCollection)),
    stream: new Readable({
      read(this: Readable): void {
        this.push(null);
      }
    }),
    destination: "",
    filename: "",
    path: ""
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AnrPlotGeometryController],
      providers: [
        {
          provide: AnrPlotGeometryService,
          useValue: (anrPlotGeometryService = createMock<AnrPlotGeometryService>())
        },
        {
          provide: GeometryFileProcessingService,
          useValue: (geometryFileProcessingService = createMock<GeometryFileProcessingService>())
        },
        {
          provide: PolicyService,
          useValue: (policyService = createMock<PolicyService>())
        }
      ]
    }).compile();

    controller = module.get<AnrPlotGeometryController>(AnrPlotGeometryController);

    Object.defineProperty(policyService, "userId", {
      value: 1,
      writable: true,
      configurable: true
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });

  describe("getPlotGeometry", () => {
    it("should throw UnauthorizedException when policy does not authorize", async () => {
      anrPlotGeometryService.getPlot.mockResolvedValue(mockPlot as AnrPlotGeometry);
      policyService.authorize.mockRejectedValue(new UnauthorizedException());

      await expect(controller.getPlotGeometry(sitePolygonUuid)).rejects.toThrow(UnauthorizedException);

      expect(anrPlotGeometryService.getPlotOrThrow).toHaveBeenCalled();
      expect(policyService.authorize).toHaveBeenCalledWith("read", mockPlot);
    });

    it("should throw NotFoundException when no plot exists for site polygon", async () => {
      policyService.authorize.mockResolvedValue(undefined);
      anrPlotGeometryService.getPlotOrThrow.mockRejectedValue(
        new NotFoundException(`No ANR plot geometry found for polygon ${sitePolygonUuid}`)
      );

      await expect(controller.getPlotGeometry(sitePolygonUuid)).rejects.toThrow(NotFoundException);
      await expect(controller.getPlotGeometry(sitePolygonUuid)).rejects.toThrow(
        `No ANR plot geometry found for polygon ${sitePolygonUuid}`
      );

      expect(anrPlotGeometryService.getPlotOrThrow).toHaveBeenCalledWith(sitePolygonUuid);
      expect(policyService.authorize).not.toHaveBeenCalled();
    });

    it("should return JSON:API document with plot geometry when found", async () => {
      policyService.authorize.mockResolvedValue(undefined);
      anrPlotGeometryService.getPlotOrThrow.mockResolvedValue(mockPlot as AnrPlotGeometry);

      const result = await controller.getPlotGeometry(sitePolygonUuid);

      expect(anrPlotGeometryService.getPlotOrThrow).toHaveBeenCalledWith(sitePolygonUuid);
      expect(policyService.authorize).toHaveBeenCalledWith("read", mockPlot);

      const serialized = serialize(result);
      expect(serialized.data).toBeDefined();
      if (serialized.data != null && !Array.isArray(serialized.data)) {
        expect(serialized.data.type).toBe("anrPlotGeometries");
        expect(serialized.data.id).toBe(sitePolygonUuid);
        expect(serialized.data.attributes).toMatchObject({
          sitePolygonUuid,
          plotCount: 5,
          createdBy: 10
        });
      }
    });
  });

  describe("getPlotGeometryGeoJson", () => {
    it("should throw UnauthorizedException when policy does not authorize", async () => {
      policyService.authorize.mockRejectedValue(new UnauthorizedException());

      await expect(controller.getPlotGeometryGeoJson(sitePolygonUuid)).rejects.toThrow(UnauthorizedException);
      expect(policyService.authorize).toHaveBeenCalledWith("read", AnrPlotGeometry);
      expect(anrPlotGeometryService.getPlotOrThrow).not.toHaveBeenCalled();
    });

    it("should throw NotFoundException when no plot exists", async () => {
      policyService.authorize.mockResolvedValue(undefined);
      anrPlotGeometryService.getPlotOrThrow.mockRejectedValue(
        new NotFoundException(`No ANR plot geometry found for polygon ${sitePolygonUuid}`)
      );

      await expect(controller.getPlotGeometryGeoJson(sitePolygonUuid)).rejects.toThrow(NotFoundException);
      expect(anrPlotGeometryService.getPlotOrThrow).toHaveBeenCalledWith(sitePolygonUuid);
    });

    it("should return GeoJsonExportDto when plot exists", async () => {
      policyService.authorize.mockResolvedValue(undefined);
      anrPlotGeometryService.getPlotOrThrow.mockResolvedValue(mockPlot as AnrPlotGeometry);

      const result = await controller.getPlotGeometryGeoJson(sitePolygonUuid);

      expect(policyService.authorize).toHaveBeenCalledWith("read", AnrPlotGeometry);
      expect(anrPlotGeometryService.getPlotOrThrow).toHaveBeenCalledWith(sitePolygonUuid);

      const serialized = serialize(result);
      expect(serialized.data).toBeDefined();
      if (serialized.data != null && !Array.isArray(serialized.data)) {
        expect(serialized.data.type).toBe("geojsonExports");
        expect(serialized.data.id).toBe(sitePolygonUuid);
        expect(serialized.data.attributes).toMatchObject({
          type: "FeatureCollection",
          features: []
        });
      }
    });
  });

  describe("upsertPlotGeometry", () => {
    it("should throw UnauthorizedException when policy does not authorize", async () => {
      policyService.authorize.mockRejectedValue(new UnauthorizedException());
      const file = createMockFile();

      await expect(controller.upsertPlotGeometry(sitePolygonUuid, file)).rejects.toThrow(UnauthorizedException);
      expect(policyService.authorize).toHaveBeenCalledWith("create", AnrPlotGeometry);
      expect(SitePolygon.findOne).not.toHaveBeenCalled();
    });

    it("should throw UnauthorizedException when userId is null", async () => {
      policyService.authorize.mockResolvedValue(undefined);
      Object.defineProperty(policyService, "userId", {
        value: null,
        writable: true,
        configurable: true
      });
      const file = createMockFile();

      await expect(controller.upsertPlotGeometry(sitePolygonUuid, file)).rejects.toThrow(UnauthorizedException);
      await expect(controller.upsertPlotGeometry(sitePolygonUuid, file)).rejects.toThrow("User must be authenticated");
    });

    it("should throw NotFoundException when site polygon does not exist", async () => {
      policyService.authorize.mockResolvedValue(undefined);
      (SitePolygon.findOne as jest.Mock).mockResolvedValue(null);
      const file = createMockFile();

      await expect(controller.upsertPlotGeometry(sitePolygonUuid, file)).rejects.toThrow(NotFoundException);
      await expect(controller.upsertPlotGeometry(sitePolygonUuid, file)).rejects.toThrow(
        `Site polygon not found: ${sitePolygonUuid}`
      );

      expect(SitePolygon.findOne).toHaveBeenCalledWith({ where: { uuid: sitePolygonUuid } });
      expect(geometryFileProcessingService.parseGeometryFile).not.toHaveBeenCalled();
    });

    it("should throw BadRequestException when file parsing fails", async () => {
      policyService.authorize.mockResolvedValue(undefined);
      (SitePolygon.findOne as jest.Mock).mockResolvedValue(mockSitePolygon as SitePolygon);
      geometryFileProcessingService.parseGeometryFile.mockRejectedValue(
        new BadRequestException("Invalid file format or no features found")
      );
      const file = createMockFile();

      await expect(controller.upsertPlotGeometry(sitePolygonUuid, file)).rejects.toThrow(BadRequestException);

      expect(geometryFileProcessingService.parseGeometryFile).toHaveBeenCalledWith(file);
      expect(anrPlotGeometryService.upsertPlot).not.toHaveBeenCalled();
    });

    it("should parse file, upsert plot and return JSON:API document", async () => {
      policyService.authorize.mockResolvedValue(undefined);
      (SitePolygon.findOne as jest.Mock).mockResolvedValue(mockSitePolygon as SitePolygon);
      geometryFileProcessingService.parseGeometryFile.mockResolvedValue(featureCollection);
      anrPlotGeometryService.upsertPlot.mockResolvedValue(mockPlot as AnrPlotGeometry);

      const file = createMockFile();
      const result = await controller.upsertPlotGeometry(sitePolygonUuid, file);

      expect(SitePolygon.findOne).toHaveBeenCalledWith({ where: { uuid: sitePolygonUuid } });
      expect(geometryFileProcessingService.parseGeometryFile).toHaveBeenCalledWith(file);
      expect(anrPlotGeometryService.upsertPlot).toHaveBeenCalledWith(sitePolygonUuid, featureCollection, 1);

      const serialized = serialize(result);
      expect(serialized.data).toBeDefined();
      if (serialized.data != null && !Array.isArray(serialized.data)) {
        expect(serialized.data.type).toBe("anrPlotGeometries");
        expect(serialized.data.id).toBe(sitePolygonUuid);
      }
    });
  });

  describe("deletePlotGeometry", () => {
    it("should throw UnauthorizedException when policy does not authorize", async () => {
      policyService.authorize.mockRejectedValue(new UnauthorizedException());

      await expect(controller.deletePlotGeometry(sitePolygonUuid)).rejects.toThrow(UnauthorizedException);
      expect(policyService.authorize).toHaveBeenCalledWith("delete", AnrPlotGeometry);
      expect(anrPlotGeometryService.getPlotOrThrow).not.toHaveBeenCalled();
    });

    it("should throw NotFoundException when no plot exists for site polygon", async () => {
      policyService.authorize.mockResolvedValue(undefined);
      anrPlotGeometryService.getPlotOrThrow.mockRejectedValue(
        new NotFoundException(`No ANR plot geometry found for polygon ${sitePolygonUuid}`)
      );

      await expect(controller.deletePlotGeometry(sitePolygonUuid)).rejects.toThrow(NotFoundException);
      await expect(controller.deletePlotGeometry(sitePolygonUuid)).rejects.toThrow(
        `No ANR plot geometry found for polygon ${sitePolygonUuid}`
      );
      expect(anrPlotGeometryService.getPlotOrThrow).toHaveBeenCalledWith(sitePolygonUuid);
      expect(anrPlotGeometryService.deletePlot).not.toHaveBeenCalled();
    });

    it("should delete plot and return deleted response when plot exists", async () => {
      policyService.authorize.mockResolvedValue(undefined);
      anrPlotGeometryService.getPlotOrThrow.mockResolvedValue(mockPlot as AnrPlotGeometry);
      anrPlotGeometryService.deletePlot.mockResolvedValue(undefined);

      const result = await controller.deletePlotGeometry(sitePolygonUuid);

      expect(policyService.authorize).toHaveBeenCalledWith("delete", AnrPlotGeometry);
      expect(anrPlotGeometryService.getPlotOrThrow).toHaveBeenCalledWith(sitePolygonUuid);
      expect(anrPlotGeometryService.deletePlot).toHaveBeenCalledWith(sitePolygonUuid);

      expect(result).toHaveProperty("meta");
      expect(result.meta).toHaveProperty("resourceType", "anrPlotGeometries");
      expect(result.meta).toHaveProperty("resourceIds", [sitePolygonUuid]);
    });
  });
});

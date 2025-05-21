import { Test } from "@nestjs/testing";
import { createMock, DeepMocked, PartialFuncReturn } from "@golevelup/ts-jest";
import { BoundingBoxService } from "./bounding-box.service";
import { DataApiService } from "@terramatch-microservices/data-api";
import { ConfigService } from "@nestjs/config";
import {
  PolygonGeometry,
  Site,
  SitePolygon,
  Project,
  LandscapeGeometry
} from "@terramatch-microservices/database/entities";
import { NotFoundException } from "@nestjs/common";
import { Sequelize } from "sequelize";

// Mock the Sequelize models
jest.mock("@terramatch-microservices/database/entities", () => {
  const mockModel = {
    findOne: jest.fn(),
    findAll: jest.fn()
  };

  return {
    PolygonGeometry: { ...mockModel },
    Site: { ...mockModel },
    SitePolygon: { ...mockModel },
    Project: { ...mockModel },
    LandscapeGeometry: { ...mockModel }
  };
});

describe("BoundingBoxService", () => {
  let service: BoundingBoxService;
  let dataApiService: DeepMocked<DataApiService>;
  let configService: DeepMocked<ConfigService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        BoundingBoxService,
        {
          provide: DataApiService,
          useValue: (dataApiService = createMock<DataApiService>())
        },
        {
          provide: ConfigService,
          useValue: (configService = createMock<ConfigService>({
            get: (key: string): PartialFuncReturn<unknown> => {
              if (key === "APP_FRONT_END") return "https://unittests.terramatch.org";
              if (key === "DATA_API_KEY") return "test-api-key";
              return "";
            }
          }))
        }
      ]
    }).compile();

    service = module.get(BoundingBoxService);

    // Reset the mocks for each test
    jest.clearAllMocks();
  });

  // Helper method to mock the Sequelize.fn used in the service
  const mockSequelizeFn = () => {
    (Sequelize.fn as jest.Mock) = jest.fn().mockReturnValue("ST_FUNCTION_MOCK");
    (Sequelize.col as jest.Mock) = jest.fn().mockImplementation(col => `COL_${col}`);
  };

  // Create a mock envelope response
  const mockEnvelopeData = (
    coordinates: number[][] = [
      [0, 0],
      [0, 10],
      [10, 10],
      [10, 0],
      [0, 0]
    ]
  ) => {
    return {
      get: jest.fn().mockReturnValue(
        JSON.stringify({
          type: "Polygon",
          coordinates: [coordinates]
        })
      )
    };
  };

  describe("getPolygonBoundingBox", () => {
    it("should return the bounding box for a polygon", async () => {
      const polygonUuid = "test-polygon-uuid";

      mockSequelizeFn();

      // Mock the findAll method of PolygonGeometry
      (PolygonGeometry.findAll as jest.Mock).mockResolvedValue([mockEnvelopeData()]);

      const result = await service.getPolygonBoundingBox(polygonUuid);

      expect(PolygonGeometry.findAll).toHaveBeenCalledWith({
        where: { uuid: polygonUuid },
        attributes: [[Sequelize.fn("ST_ASGEOJSON", Sequelize.fn("ST_Envelope", Sequelize.col("geom"))), "envelope"]]
      });

      expect(result.bbox).toEqual([0, 0, 10, 10]);
    });

    it("should throw NotFoundException when polygon not found", async () => {
      const polygonUuid = "non-existent-uuid";

      (PolygonGeometry.findAll as jest.Mock).mockResolvedValue([]);

      await expect(service.getPolygonBoundingBox(polygonUuid)).rejects.toThrow(NotFoundException);
    });
  });

  describe("getSiteBoundingBox", () => {
    it("should return the bounding box for a site's polygons", async () => {
      const siteUuid = "test-site-uuid";

      (Site.findOne as jest.Mock).mockResolvedValue({ uuid: siteUuid });

      (SitePolygon.findAll as jest.Mock).mockResolvedValue([
        { polygonUuid: "polygon-1" },
        { polygonUuid: "polygon-2" }
      ]);

      mockSequelizeFn();

      (PolygonGeometry.findAll as jest.Mock).mockResolvedValue([
        mockEnvelopeData([
          [0, 0],
          [0, 5],
          [5, 5],
          [5, 0],
          [0, 0]
        ]),
        mockEnvelopeData([
          [5, 5],
          [5, 10],
          [10, 10],
          [10, 5],
          [5, 5]
        ])
      ]);

      const result = await service.getSiteBoundingBox(siteUuid);

      expect(Site.findOne).toHaveBeenCalledWith({
        where: { uuid: siteUuid },
        attributes: ["uuid"]
      });

      expect(SitePolygon.findAll).toHaveBeenCalledWith({
        where: {
          siteUuid,
          polygonUuid: { [Symbol.for("ne")]: "" },
          isActive: true,
          deletedAt: null
        },
        attributes: ["polygonUuid"]
      });

      expect(PolygonGeometry.findAll).toHaveBeenCalledWith({
        where: { uuid: { [Symbol.for("in")]: ["polygon-1", "polygon-2"] } },
        attributes: [[Sequelize.fn("ST_ASGEOJSON", Sequelize.fn("ST_Envelope", Sequelize.col("geom"))), "envelope"]]
      });

      expect(result.bbox).toEqual([0, 0, 10, 10]);
    });

    it("should throw NotFoundException when site not found", async () => {
      const siteUuid = "non-existent-uuid";

      (Site.findOne as jest.Mock).mockResolvedValue(null);

      await expect(service.getSiteBoundingBox(siteUuid)).rejects.toThrow(NotFoundException);
    });

    it("should throw NotFoundException when site has no polygons", async () => {
      const siteUuid = "test-site-uuid";

      (Site.findOne as jest.Mock).mockResolvedValue({ uuid: siteUuid });

      (SitePolygon.findAll as jest.Mock).mockResolvedValue([]);

      await expect(service.getSiteBoundingBox(siteUuid)).rejects.toThrow(NotFoundException);
    });
  });

  describe("getProjectBoundingBox", () => {
    it("should return the bounding box for a project's sites and polygons", async () => {
      const projectUuid = "test-project-uuid";

      (Project.findOne as jest.Mock).mockResolvedValue({ id: 123 });

      (Site.findAll as jest.Mock).mockResolvedValue([{ uuid: "site-1" }, { uuid: "site-2" }]);

      (SitePolygon.findAll as jest.Mock).mockResolvedValue([
        { polygonUuid: "polygon-1" },
        { polygonUuid: "polygon-2" }
      ]);

      mockSequelizeFn();

      (PolygonGeometry.findAll as jest.Mock).mockResolvedValue([mockEnvelopeData()]);

      const result = await service.getProjectBoundingBox(projectUuid);

      expect(Project.findOne).toHaveBeenCalledWith({
        where: { uuid: projectUuid },
        attributes: ["id"]
      });

      expect(Site.findAll).toHaveBeenCalledWith({
        where: { projectId: 123 },
        attributes: ["uuid"]
      });

      expect(SitePolygon.findAll).toHaveBeenCalledWith({
        where: {
          siteUuid: { [Symbol.for("in")]: ["site-1", "site-2"] },
          polygonUuid: { [Symbol.for("ne")]: "" }
        },
        attributes: ["polygonUuid"]
      });

      expect(PolygonGeometry.findAll).toHaveBeenCalledWith({
        where: { uuid: { [Symbol.for("in")]: ["polygon-1", "polygon-2"] } },
        attributes: [[Sequelize.fn("ST_ASGEOJSON", Sequelize.fn("ST_Envelope", Sequelize.col("geom"))), "envelope"]]
      });

      expect(result.bbox).toEqual([0, 0, 10, 10]);
    });
  });

  describe("getCountryLandscapeBoundingBox", () => {
    it("should return the combined bounding box for a country and landscapes", async () => {
      const country = "KEN";
      const landscapes = ["landscape-1", "landscape-2"];

      (LandscapeGeometry.findAll as jest.Mock).mockResolvedValue([
        mockEnvelopeData([
          [0, 0],
          [0, 5],
          [5, 5],
          [5, 0],
          [0, 0]
        ])
      ]);

      dataApiService.getCountryEnvelope.mockResolvedValue([
        {
          envelope: JSON.stringify({
            type: "Polygon",
            coordinates: [
              [
                [5, 5],
                [5, 10],
                [10, 10],
                [10, 5],
                [5, 5]
              ]
            ]
          })
        }
      ]);

      const result = await service.getCountryLandscapeBoundingBox(country, landscapes);

      expect(LandscapeGeometry.findAll).toHaveBeenCalledWith({
        where: { slug: { [Symbol.for("in")]: landscapes } },
        attributes: [[Sequelize.fn("ST_ASGEOJSON", Sequelize.fn("ST_Envelope", Sequelize.col("geometry"))), "envelope"]]
      });

      expect(dataApiService.getCountryEnvelope).toHaveBeenCalledWith("KEN");

      expect(result.bbox).toEqual([0, 0, 10, 10]);
    });

    it("should return only landscape bounding box when country is not found", async () => {
      const country = "INVALID";
      const landscapes = ["landscape-1"];

      (LandscapeGeometry.findAll as jest.Mock).mockResolvedValue([mockEnvelopeData()]);

      dataApiService.getCountryEnvelope.mockRejectedValue(new Error("Country not found"));

      const result = await service.getCountryLandscapeBoundingBox(country, landscapes);

      expect(result.bbox).toEqual([0, 0, 10, 10]);
    });

    it("should return only country bounding box when no landscapes are provided", async () => {
      const country = "BEN";
      const landscapes: string[] = [];

      dataApiService.getCountryEnvelope.mockResolvedValue([
        {
          envelope: JSON.stringify({
            type: "Polygon",
            coordinates: [
              [
                [0, 0],
                [0, 10],
                [10, 10],
                [10, 0],
                [0, 0]
              ]
            ]
          })
        }
      ]);

      const result = await service.getCountryLandscapeBoundingBox(country, landscapes);

      expect(dataApiService.getCountryEnvelope).toHaveBeenCalledWith("KEN");
      expect(result.bbox).toEqual([0, 0, 10, 10]);
    });

    it("should throw NotFoundException when neither country nor landscapes are found", async () => {
      const country = "INVALID";
      const landscapes: string[] = ["non-existent"];

      (LandscapeGeometry.findAll as jest.Mock).mockResolvedValue([]);

      dataApiService.getCountryEnvelope.mockRejectedValue(new Error("Country not found"));

      await expect(service.getCountryLandscapeBoundingBox(country, landscapes)).rejects.toThrow(NotFoundException);
    });
  });
});

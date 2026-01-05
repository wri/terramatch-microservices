import { Test, TestingModule } from "@nestjs/testing";
import { GeoJsonExportService } from "./geojson-export.service";
import { BadRequestException, InternalServerErrorException, NotFoundException } from "@nestjs/common";
import {
  PolygonGeometry,
  Project,
  Site,
  SitePolygon,
  SitePolygonData
} from "@terramatch-microservices/database/entities";
import { Polygon } from "geojson";
import { GeoJsonQueryDto } from "./dto/geojson-query.dto";

jest.mock("@terramatch-microservices/database/entities", () => ({
  PolygonGeometry: {
    getGeoJSON: jest.fn(),
    getGeoJSONBatch: jest.fn()
  },
  SitePolygon: {
    findOne: jest.fn(),
    findAll: jest.fn()
  },
  Site: {
    findOne: jest.fn(),
    findAll: jest.fn()
  },
  SitePolygonData: {
    findOne: jest.fn(),
    findAll: jest.fn()
  },
  Project: {
    findOne: jest.fn(),
    findAll: jest.fn()
  }
}));

describe("GeoJsonExportService", () => {
  let service: GeoJsonExportService;

  const mockPolygonGeometry = PolygonGeometry as jest.Mocked<typeof PolygonGeometry>;
  const mockSitePolygon = SitePolygon as jest.Mocked<typeof SitePolygon>;
  const mockSite = Site as jest.Mocked<typeof Site>;
  const mockSitePolygonData = SitePolygonData as jest.Mocked<typeof SitePolygonData>;
  const mockProjectEntity = Project as jest.Mocked<typeof Project>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [GeoJsonExportService]
    }).compile();

    service = module.get<GeoJsonExportService>(GeoJsonExportService);
    jest.clearAllMocks();
  });

  describe("getGeoJson", () => {
    it("should throw BadRequestException when no parameters are provided", async () => {
      const query: GeoJsonQueryDto = {};

      await expect(service.getGeoJson(query)).rejects.toThrow(
        new BadRequestException("Exactly one of uuid, siteUuid, or projectUuid must be provided")
      );
    });

    it("should throw BadRequestException when both uuid and siteUuid are provided", async () => {
      const query: GeoJsonQueryDto = {
        uuid: "polygon-uuid",
        siteUuid: "site-uuid"
      };

      await expect(service.getGeoJson(query)).rejects.toThrow(
        new BadRequestException("Exactly one of uuid, siteUuid, or projectUuid must be provided")
      );
    });

    it("should throw BadRequestException when both uuid and projectUuid are provided", async () => {
      const query: GeoJsonQueryDto = {
        uuid: "polygon-uuid",
        projectUuid: "project-uuid"
      };

      await expect(service.getGeoJson(query)).rejects.toThrow(
        new BadRequestException("Exactly one of uuid, siteUuid, or projectUuid must be provided")
      );
    });

    it("should throw BadRequestException when both siteUuid and projectUuid are provided", async () => {
      const query: GeoJsonQueryDto = {
        siteUuid: "site-uuid",
        projectUuid: "project-uuid"
      };

      await expect(service.getGeoJson(query)).rejects.toThrow(
        new BadRequestException("Exactly one of uuid, siteUuid, or projectUuid must be provided")
      );
    });

    it("should throw BadRequestException when all three parameters are provided", async () => {
      const query: GeoJsonQueryDto = {
        uuid: "polygon-uuid",
        siteUuid: "site-uuid",
        projectUuid: "project-uuid"
      };

      await expect(service.getGeoJson(query)).rejects.toThrow(
        new BadRequestException("Exactly one of uuid, siteUuid, or projectUuid must be provided")
      );
    });

    describe("single polygon (uuid)", () => {
      const polygonUuid = "polygon-uuid-123";
      const sitePolygonUuid = "site-polygon-uuid-123";
      const siteUuid = "site-uuid-123";
      const mockGeometry: Polygon = {
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
      const mockGeoJsonString = JSON.stringify(mockGeometry);

      const mockSitePolygonInstance = {
        uuid: sitePolygonUuid,
        polygonUuid,
        siteUuid,
        polyName: "Test Polygon",
        plantStart: new Date("2024-01-01"),
        practice: ["direct-seeding"],
        targetSys: "agroforestry",
        distr: ["single-line"],
        numTrees: 1500,
        site: {
          uuid: siteUuid,
          name: "Test Site"
        }
      } as unknown as SitePolygon;

      it("should return FeatureCollection with geometry only when geometryOnly is true", async () => {
        const query: GeoJsonQueryDto = {
          uuid: polygonUuid,
          geometryOnly: true
        };

        mockPolygonGeometry.getGeoJSON.mockResolvedValue(mockGeoJsonString);

        const result = await service.getGeoJson(query);

        expect(result).toEqual({
          type: "FeatureCollection",
          features: [
            {
              type: "Feature",
              geometry: mockGeometry,
              properties: {}
            }
          ]
        });
        expect(mockPolygonGeometry.getGeoJSON).toHaveBeenCalledWith(polygonUuid);
        expect(mockSitePolygon.findOne).not.toHaveBeenCalled();
      });

      it("should return FeatureCollection with properties when geometryOnly is false", async () => {
        const query: GeoJsonQueryDto = {
          uuid: polygonUuid,
          geometryOnly: false,
          includeExtendedData: true
        };

        mockPolygonGeometry.getGeoJSON.mockResolvedValue(mockGeoJsonString);
        mockSitePolygon.findOne.mockResolvedValue(mockSitePolygonInstance);
        mockSitePolygonData.findOne.mockResolvedValue(null);

        const result = await service.getGeoJson(query);

        expect(result.type).toBe("FeatureCollection");
        expect(result.features).toHaveLength(1);
        expect(result.features[0].type).toBe("Feature");
        expect(result.features[0].geometry).toEqual(mockGeometry);
        expect(result.features[0].properties).toEqual({
          uuid: sitePolygonUuid,
          polyName: "Test Polygon",
          plantStart: new Date("2024-01-01"),
          practice: ["direct-seeding"],
          targetSys: "agroforestry",
          distr: ["single-line"],
          numTrees: 1500,
          siteId: siteUuid
        });
        expect(mockPolygonGeometry.getGeoJSON).toHaveBeenCalledWith(polygonUuid);
        expect(mockSitePolygon.findOne).toHaveBeenCalledWith({
          where: { polygonUuid },
          include: [{ model: Site, attributes: ["uuid", "name"] }]
        });
      });

      it("should include extended data when includeExtendedData is true", async () => {
        const query: GeoJsonQueryDto = {
          uuid: polygonUuid,
          includeExtendedData: true
        };

        const extendedData = {
          customField1: "value1",
          customField2: 123
        };

        mockPolygonGeometry.getGeoJSON.mockResolvedValue(mockGeoJsonString);
        mockSitePolygon.findOne.mockResolvedValue(mockSitePolygonInstance);
        mockSitePolygonData.findOne.mockResolvedValue({
          sitePolygonUuid,
          data: extendedData
        } as unknown as SitePolygonData);

        const result = await service.getGeoJson(query);

        expect(result.features[0].properties).toMatchObject(extendedData);
        expect(mockSitePolygonData.findOne).toHaveBeenCalledWith({
          where: { sitePolygonUuid }
        });
      });

      it("should not include extended data when includeExtendedData is false", async () => {
        const query: GeoJsonQueryDto = {
          uuid: polygonUuid,
          includeExtendedData: false
        };

        mockPolygonGeometry.getGeoJSON.mockResolvedValue(mockGeoJsonString);
        mockSitePolygon.findOne.mockResolvedValue(mockSitePolygonInstance);

        const result = await service.getGeoJson(query);

        expect(result.features[0].properties).not.toHaveProperty("customField1");
        expect(mockSitePolygonData.findOne).not.toHaveBeenCalled();
      });

      it("should throw NotFoundException when polygon geometry is not found", async () => {
        const query: GeoJsonQueryDto = {
          uuid: polygonUuid
        };

        mockPolygonGeometry.getGeoJSON.mockResolvedValue(undefined);

        await expect(service.getGeoJson(query)).rejects.toThrow(
          new NotFoundException(`Polygon geometry not found for uuid: ${polygonUuid}`)
        );
      });

      it("should throw NotFoundException when site polygon is not found", async () => {
        const query: GeoJsonQueryDto = {
          uuid: polygonUuid,
          geometryOnly: false
        };

        mockPolygonGeometry.getGeoJSON.mockResolvedValue(mockGeoJsonString);
        mockSitePolygon.findOne.mockResolvedValue(null);

        await expect(service.getGeoJson(query)).rejects.toThrow(
          new NotFoundException(`Site polygon not found for polygon uuid: ${polygonUuid}`)
        );
      });

      it("should throw InternalServerErrorException when geometry JSON is invalid", async () => {
        const query: GeoJsonQueryDto = {
          uuid: polygonUuid
        };

        mockPolygonGeometry.getGeoJSON.mockResolvedValue("invalid-json");

        await expect(service.getGeoJson(query)).rejects.toThrow(InternalServerErrorException);
      });

      it("should handle null values in site polygon properties", async () => {
        const query: GeoJsonQueryDto = {
          uuid: polygonUuid
        };

        const sitePolygonWithNulls = {
          uuid: sitePolygonUuid,
          polygonUuid,
          siteUuid,
          polyName: null,
          plantStart: null,
          practice: null,
          targetSys: null,
          distr: null,
          numTrees: null,
          site: {
            uuid: siteUuid,
            name: "Test Site"
          }
        } as unknown as SitePolygon;

        mockPolygonGeometry.getGeoJSON.mockResolvedValue(mockGeoJsonString);
        mockSitePolygon.findOne.mockResolvedValue(sitePolygonWithNulls);
        mockSitePolygonData.findOne.mockResolvedValue(null);

        const result = await service.getGeoJson(query);

        expect(result.features[0].properties).toEqual({
          uuid: sitePolygonUuid,
          polyName: null,
          plantStart: null,
          practice: null,
          targetSys: null,
          distr: null,
          numTrees: null,
          siteId: siteUuid
        });
      });
    });

    describe("site polygons (siteUuid)", () => {
      const siteUuid = "site-uuid-123";
      const polygonUuid1 = "polygon-uuid-1";
      const polygonUuid2 = "polygon-uuid-2";
      const sitePolygonUuid1 = "site-polygon-uuid-1";
      const sitePolygonUuid2 = "site-polygon-uuid-2";

      const mockGeometry1: Polygon = {
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

      const mockGeometry2: Polygon = {
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

      const mockSitePolygon1 = {
        uuid: sitePolygonUuid1,
        polygonUuid: polygonUuid1,
        siteUuid,
        polyName: "Polygon 1",
        plantStart: new Date("2024-01-01"),
        practice: ["direct-seeding"],
        targetSys: "agroforestry",
        distr: ["single-line"],
        numTrees: 1000,
        isActive: true,
        site: {
          uuid: siteUuid,
          name: "Test Site"
        }
      } as unknown as SitePolygon;

      const mockSitePolygon2 = {
        uuid: sitePolygonUuid2,
        polygonUuid: polygonUuid2,
        siteUuid,
        polyName: "Polygon 2",
        plantStart: new Date("2024-02-01"),
        practice: ["direct-seeding"],
        targetSys: "silvopasture",
        distr: ["single-line"],
        numTrees: 2000,
        isActive: true,
        site: {
          uuid: siteUuid,
          name: "Test Site"
        }
      } as unknown as SitePolygon;

      it("should return FeatureCollection with all active polygons for a site", async () => {
        const query: GeoJsonQueryDto = {
          siteUuid,
          includeExtendedData: false
        };

        mockSitePolygon.findAll.mockResolvedValue([mockSitePolygon1, mockSitePolygon2]);
        mockPolygonGeometry.getGeoJSONBatch.mockResolvedValue([
          { uuid: polygonUuid1, geoJson: JSON.stringify(mockGeometry1) },
          { uuid: polygonUuid2, geoJson: JSON.stringify(mockGeometry2) }
        ]);

        const result = await service.getGeoJson(query);

        expect(result.type).toBe("FeatureCollection");
        expect(result.features).toHaveLength(2);
        expect(result.features[0].properties).toMatchObject({
          uuid: sitePolygonUuid1,
          polyName: "Polygon 1"
        });
        expect(result.features[1].properties).toMatchObject({
          uuid: sitePolygonUuid2,
          polyName: "Polygon 2"
        });
        expect(mockSitePolygon.findAll).toHaveBeenCalledWith({
          where: { siteUuid, isActive: true },
          include: [{ model: Site, attributes: ["uuid", "name"] }]
        });
        expect(mockPolygonGeometry.getGeoJSONBatch).toHaveBeenCalledWith([polygonUuid1, polygonUuid2]);
      });

      it("should include extended data for all polygons when includeExtendedData is true", async () => {
        const query: GeoJsonQueryDto = {
          siteUuid,
          includeExtendedData: true
        };

        const extendedData1 = { customField1: "value1" };
        const extendedData2 = { customField2: "value2" };

        mockSitePolygon.findAll.mockResolvedValue([mockSitePolygon1, mockSitePolygon2]);
        mockPolygonGeometry.getGeoJSONBatch.mockResolvedValue([
          { uuid: polygonUuid1, geoJson: JSON.stringify(mockGeometry1) },
          { uuid: polygonUuid2, geoJson: JSON.stringify(mockGeometry2) }
        ]);
        mockSitePolygonData.findAll.mockResolvedValue([
          { sitePolygonUuid: sitePolygonUuid1, data: extendedData1 } as unknown as SitePolygonData,
          { sitePolygonUuid: sitePolygonUuid2, data: extendedData2 } as unknown as SitePolygonData
        ]);

        const result = await service.getGeoJson(query);

        expect(result.features[0].properties).toMatchObject(extendedData1);
        expect(result.features[1].properties).toMatchObject(extendedData2);
        expect(mockSitePolygonData.findAll).toHaveBeenCalledWith({
          where: { sitePolygonUuid: [sitePolygonUuid1, sitePolygonUuid2] }
        });
      });

      it("should return empty FeatureCollection when site has no active polygons", async () => {
        const query: GeoJsonQueryDto = {
          siteUuid
        };

        const mockSiteInstance = {
          uuid: siteUuid,
          name: "Test Site"
        } as unknown as Site;

        mockSitePolygon.findAll.mockResolvedValue([]);
        mockSite.findOne.mockResolvedValue(mockSiteInstance);

        const result = await service.getGeoJson(query);

        expect(result.type).toBe("FeatureCollection");
        expect(result.features).toHaveLength(0);
        expect(mockSite.findOne).toHaveBeenCalledWith({ where: { uuid: siteUuid } });
      });

      it("should throw NotFoundException when site does not exist", async () => {
        const query: GeoJsonQueryDto = {
          siteUuid
        };

        mockSitePolygon.findAll.mockResolvedValue([]);
        mockSite.findOne.mockResolvedValue(null);

        await expect(service.getGeoJson(query)).rejects.toThrow(
          new NotFoundException(`Site not found for uuid: ${siteUuid}`)
        );
      });

      it("should skip polygons with invalid geometry JSON", async () => {
        const query: GeoJsonQueryDto = {
          siteUuid
        };

        mockSitePolygon.findAll.mockResolvedValue([mockSitePolygon1, mockSitePolygon2]);
        mockPolygonGeometry.getGeoJSONBatch.mockResolvedValue([
          { uuid: polygonUuid1, geoJson: JSON.stringify(mockGeometry1) },
          { uuid: polygonUuid2, geoJson: "invalid-json" }
        ]);

        const result = await service.getGeoJson(query);

        expect(result.features).toHaveLength(1);
        expect(result.features[0].properties).toMatchObject({
          uuid: sitePolygonUuid1
        });
      });

      it("should skip polygons without polygonUuid", async () => {
        const query: GeoJsonQueryDto = {
          siteUuid
        };

        const sitePolygonWithoutUuid = {
          ...mockSitePolygon1,
          polygonUuid: null
        } as unknown as SitePolygon;

        mockSitePolygon.findAll.mockResolvedValue([sitePolygonWithoutUuid, mockSitePolygon2]);
        mockPolygonGeometry.getGeoJSONBatch.mockResolvedValue([
          { uuid: polygonUuid2, geoJson: JSON.stringify(mockGeometry2) }
        ]);

        const result = await service.getGeoJson(query);

        expect(result.features).toHaveLength(1);
        expect(result.features[0].properties).toMatchObject({
          uuid: sitePolygonUuid2
        });
      });

      it("should return empty FeatureCollection when all polygons have invalid geometry", async () => {
        const query: GeoJsonQueryDto = {
          siteUuid
        };

        mockSitePolygon.findAll.mockResolvedValue([mockSitePolygon1]);
        mockPolygonGeometry.getGeoJSONBatch.mockResolvedValue([{ uuid: polygonUuid1, geoJson: "invalid-json" }]);

        const result = await service.getGeoJson(query);

        expect(result.type).toBe("FeatureCollection");
        expect(result.features).toHaveLength(0);
      });

      it("should handle site polygons with no extended data", async () => {
        const query: GeoJsonQueryDto = {
          siteUuid,
          includeExtendedData: true
        };

        mockSitePolygon.findAll.mockResolvedValue([mockSitePolygon1]);
        mockPolygonGeometry.getGeoJSONBatch.mockResolvedValue([
          { uuid: polygonUuid1, geoJson: JSON.stringify(mockGeometry1) }
        ]);
        mockSitePolygonData.findAll.mockResolvedValue([]);

        const result = await service.getGeoJson(query);

        expect(result.features).toHaveLength(1);
        expect(result.features[0].properties).not.toHaveProperty("customField1");
      });
    });

    describe("project polygons (projectUuid)", () => {
      const projectUuid = "project-uuid-123";
      const projectId = 456;
      const siteUuid1 = "site-uuid-1";
      const siteUuid2 = "site-uuid-2";
      const polygonUuid1 = "polygon-uuid-1";
      const polygonUuid2 = "polygon-uuid-2";
      const polygonUuid3 = "polygon-uuid-3";
      const sitePolygonUuid1 = "site-polygon-uuid-1";
      const sitePolygonUuid2 = "site-polygon-uuid-2";
      const sitePolygonUuid3 = "site-polygon-uuid-3";

      const mockGeometry1: Polygon = {
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

      const mockGeometry2: Polygon = {
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

      const mockGeometry3: Polygon = {
        type: "Polygon",
        coordinates: [
          [
            [4, 4],
            [4, 5],
            [5, 5],
            [5, 4],
            [4, 4]
          ]
        ]
      };

      const mockProject = {
        id: projectId,
        uuid: projectUuid
      };

      const mockSites = [
        { uuid: siteUuid1, name: "Site 1" },
        { uuid: siteUuid2, name: "Site 2" }
      ];

      const mockSitePolygon1 = {
        uuid: sitePolygonUuid1,
        polygonUuid: polygonUuid1,
        siteUuid: siteUuid1,
        polyName: "Project Polygon 1",
        plantStart: new Date("2024-01-01"),
        practice: ["direct-seeding"],
        targetSys: "agroforestry",
        distr: ["single-line"],
        numTrees: 1000,
        isActive: true,
        site: {
          uuid: siteUuid1,
          name: "Site 1"
        }
      } as unknown as SitePolygon;

      const mockSitePolygon2 = {
        uuid: sitePolygonUuid2,
        polygonUuid: polygonUuid2,
        siteUuid: siteUuid1,
        polyName: "Project Polygon 2",
        plantStart: new Date("2024-02-01"),
        practice: ["direct-seeding"],
        targetSys: "silvopasture",
        distr: ["single-line"],
        numTrees: 2000,
        isActive: true,
        site: {
          uuid: siteUuid1,
          name: "Site 1"
        }
      } as unknown as SitePolygon;

      const mockSitePolygon3 = {
        uuid: sitePolygonUuid3,
        polygonUuid: polygonUuid3,
        siteUuid: siteUuid2,
        polyName: "Project Polygon 3",
        plantStart: new Date("2024-03-01"),
        practice: ["direct-seeding"],
        targetSys: "agroforestry",
        distr: ["single-line"],
        numTrees: 3000,
        isActive: true,
        site: {
          uuid: siteUuid2,
          name: "Site 2"
        }
      } as unknown as SitePolygon;

      it("should return FeatureCollection with all active polygons for a project", async () => {
        const query: GeoJsonQueryDto = {
          projectUuid,
          includeExtendedData: false
        };

        mockProjectEntity.findOne.mockResolvedValue(mockProject as never);
        mockSite.findAll.mockResolvedValue(mockSites as never);
        mockSitePolygon.findAll.mockResolvedValue([mockSitePolygon1, mockSitePolygon2, mockSitePolygon3]);
        mockPolygonGeometry.getGeoJSONBatch.mockResolvedValue([
          { uuid: polygonUuid1, geoJson: JSON.stringify(mockGeometry1) },
          { uuid: polygonUuid2, geoJson: JSON.stringify(mockGeometry2) },
          { uuid: polygonUuid3, geoJson: JSON.stringify(mockGeometry3) }
        ]);

        const result = await service.getGeoJson(query);

        expect(result.type).toBe("FeatureCollection");
        expect(result.features).toHaveLength(3);
        expect(result.features[0].properties).toMatchObject({
          uuid: sitePolygonUuid1,
          polyName: "Project Polygon 1",
          siteId: siteUuid1
        });
        expect(result.features[1].properties).toMatchObject({
          uuid: sitePolygonUuid2,
          polyName: "Project Polygon 2",
          siteId: siteUuid1
        });
        expect(result.features[2].properties).toMatchObject({
          uuid: sitePolygonUuid3,
          polyName: "Project Polygon 3",
          siteId: siteUuid2
        });
        expect(mockProjectEntity.findOne).toHaveBeenCalledWith({
          where: { uuid: projectUuid },
          attributes: ["id", "uuid"]
        });
        expect(mockSite.findAll).toHaveBeenCalledWith({
          where: { projectId: projectId },
          attributes: ["uuid"]
        });
        expect(mockPolygonGeometry.getGeoJSONBatch).toHaveBeenCalledWith([polygonUuid1, polygonUuid2, polygonUuid3]);
      });

      it("should include extended data for project polygons when includeExtendedData is true", async () => {
        const query: GeoJsonQueryDto = {
          projectUuid,
          includeExtendedData: true
        };

        const extendedData1 = { customField1: "value1" };
        const extendedData2 = { customField2: "value2" };

        mockProjectEntity.findOne.mockResolvedValue(mockProject as never);
        mockSite.findAll.mockResolvedValue(mockSites as never);
        mockSitePolygon.findAll.mockResolvedValue([mockSitePolygon1, mockSitePolygon2, mockSitePolygon3]);
        mockPolygonGeometry.getGeoJSONBatch.mockResolvedValue([
          { uuid: polygonUuid1, geoJson: JSON.stringify(mockGeometry1) },
          { uuid: polygonUuid2, geoJson: JSON.stringify(mockGeometry2) },
          { uuid: polygonUuid3, geoJson: JSON.stringify(mockGeometry3) }
        ]);
        mockSitePolygonData.findAll.mockResolvedValue([
          { sitePolygonUuid: sitePolygonUuid1, data: extendedData1 } as unknown as SitePolygonData,
          { sitePolygonUuid: sitePolygonUuid2, data: extendedData2 } as unknown as SitePolygonData
        ]);

        const result = await service.getGeoJson(query);

        expect(result.features[0].properties).toMatchObject(extendedData1);
        expect(result.features[1].properties).toMatchObject(extendedData2);
        expect(mockSitePolygonData.findAll).toHaveBeenCalledWith({
          where: { sitePolygonUuid: [sitePolygonUuid1, sitePolygonUuid2, sitePolygonUuid3] }
        });
      });

      it("should throw NotFoundException when project does not exist", async () => {
        const query: GeoJsonQueryDto = {
          projectUuid
        };

        mockProjectEntity.findOne.mockResolvedValue(null);

        await expect(service.getGeoJson(query)).rejects.toThrow(
          new NotFoundException(`Project not found for uuid: ${projectUuid}`)
        );
        expect(mockSite.findAll).not.toHaveBeenCalled();
      });

      it("should return empty FeatureCollection when project has no sites", async () => {
        const query: GeoJsonQueryDto = {
          projectUuid
        };

        mockProjectEntity.findOne.mockResolvedValue(mockProject as never);
        mockSite.findAll.mockResolvedValue([]);

        const result = await service.getGeoJson(query);

        expect(result.type).toBe("FeatureCollection");
        expect(result.features).toHaveLength(0);
        expect(mockSitePolygon.findAll).not.toHaveBeenCalled();
      });

      it("should return empty FeatureCollection when project sites have no active polygons", async () => {
        const query: GeoJsonQueryDto = {
          projectUuid
        };

        mockProjectEntity.findOne.mockResolvedValue(mockProject as never);
        mockSite.findAll.mockResolvedValue(mockSites as never);
        mockSitePolygon.findAll.mockResolvedValue([]);

        const result = await service.getGeoJson(query);

        expect(result.type).toBe("FeatureCollection");
        expect(result.features).toHaveLength(0);
      });

      it("should skip polygons with invalid geometry in project query", async () => {
        const query: GeoJsonQueryDto = {
          projectUuid
        };

        mockProjectEntity.findOne.mockResolvedValue(mockProject as never);
        mockSite.findAll.mockResolvedValue(mockSites as never);
        mockSitePolygon.findAll.mockResolvedValue([mockSitePolygon1, mockSitePolygon2]);
        mockPolygonGeometry.getGeoJSONBatch.mockResolvedValue([
          { uuid: polygonUuid1, geoJson: JSON.stringify(mockGeometry1) },
          { uuid: polygonUuid2, geoJson: "invalid-json" }
        ]);

        const result = await service.getGeoJson(query);

        expect(result.features).toHaveLength(1);
        expect(result.features[0].properties).toMatchObject({
          uuid: sitePolygonUuid1
        });
      });
    });
  });
});

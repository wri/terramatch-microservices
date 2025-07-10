import { Test, TestingModule } from "@nestjs/testing";
import { BoundingBoxService } from "./bounding-box.service";
import { DataApiService } from "@terramatch-microservices/data-api";
import { ConfigService } from "@nestjs/config";
import { NotFoundException } from "@nestjs/common";
import {
  LandscapeGeometry,
  PolygonGeometry,
  Project,
  Site,
  SitePolygon,
  ProjectPitch,
  ProjectPolygon
} from "@terramatch-microservices/database/entities";
import { Model, Sequelize, Op } from "sequelize";
import { PolicyService } from "@terramatch-microservices/common";

jest.mock("@terramatch-microservices/database/entities", () => ({
  LandscapeGeometry: {
    findAll: jest.fn()
  },
  PolygonGeometry: {
    findAll: jest.fn(),
    findOne: jest.fn()
  },
  Project: {
    findOne: jest.fn()
  },
  ProjectPitch: {
    findOne: jest.fn()
  },
  ProjectPolygon: {
    findAll: jest.fn(),
    LARAVEL_TYPE_PROJECT_PITCH: "App\\Models\\V2\\ProjectPitch"
  },
  Site: {
    findOne: jest.fn(),
    findAll: jest.fn()
  },
  SitePolygon: {
    findAll: jest.fn(),
    findOne: jest.fn()
  }
}));

/**
 * Helper function to create an envelope model with the specified coordinates
 * @param minLng - Minimum longitude (west)
 * @param minLat - Minimum latitude (south)
 * @param maxLng - Maximum longitude (east)
 * @param maxLat - Maximum latitude (north)
 * @returns Mocked Sequelize model with envelope data
 */
const createEnvelopeModel = (minLng: number, minLat: number, maxLng: number, maxLat: number): Model => {
  const envelope = {
    type: "Polygon",
    coordinates: [
      [
        [minLng, minLat],
        [minLng, maxLat],
        [maxLng, maxLat],
        [maxLng, minLat],
        [minLng, minLat]
      ]
    ]
  };

  return {
    get: (field: string) => {
      if (field === "envelope") {
        return JSON.stringify(envelope);
      }
      return null;
    }
  } as unknown as Model;
};

// Real-world GeoJSON example for Lake Kivu & Rusizi River Basin landscape
const kiruLandscapeGeojson = {
  type: "MultiPolygon",
  coordinates: [
    [
      [
        [29.18506007942642, -4.39210978647958],
        [29.049432712131193, -4.576956176757733],
        [28.933333333333508, -4.279166666666697],
        [28.932980007595404, -4.26840888129334],
        [28.929519992404607, -4.26492445203985],
        [28.92881334092897, -4.260075547960014],
        [28.921186659071168, -4.252424452039918],
        [28.920833333333462, -4.249999999999886],
        [29.530643464000207, -1.572198986999865],
        [29.538192748000085, -1.574532270999839],
        [29.53823471000021, -1.574555038999961],
        [29.538278579000178, -1.574598788999936],
        [29.538309098000127, -1.574503063999884],
        [29.538335800000198, -1.574447154999916],
        [29.53834533700001, -1.574392913999759],
        [29.53835868799996, -1.574340581999877],
        [29.538417816000276, -1.574145554999916],
        [29.538518906000263, -1.573845743999698],
        [29.538558960000216, -1.573712109999747],
        [29.55958938600014, -1.570227383999963]
      ]
    ]
  ]
};

const createKiruLandscapeEnvelopeModel = (): Model => {
  let maxLng = -Infinity;
  let minLng = Infinity;
  let maxLat = -Infinity;
  let minLat = Infinity;

  for (const polygon of kiruLandscapeGeojson.coordinates) {
    for (const ring of polygon) {
      for (const [lng, lat] of ring) {
        maxLng = Math.max(maxLng, lng);
        minLng = Math.min(minLng, lng);
        maxLat = Math.max(maxLat, lat);
        minLat = Math.min(minLat, lat);
      }
    }
  }

  const envelope = {
    type: "Polygon",
    coordinates: [
      [
        [minLng, minLat],
        [minLng, maxLat],
        [maxLng, maxLat],
        [maxLng, minLat],
        [minLng, minLat]
      ]
    ]
  };

  return {
    get: (field: string) => {
      if (field === "envelope") {
        return JSON.stringify(envelope);
      } else if (field === "slug") {
        return "ikr";
      }
      return null;
    }
  } as unknown as Model;
};

const fixtures = {
  polygon: {
    uuid: "polygon-123",
    envelope: createEnvelopeModel(-74.006, 40.7128, -73.9538, 40.8075)
  },
  polygon2: {
    uuid: "polygon-456",
    envelope: createEnvelopeModel(-122.4194, 37.7749, -122.4076, 37.7894)
  },
  site: {
    uuid: "site-123",
    frameworkKey: "ppc",
    projectId: 1
  },
  sitePolygon: {
    id: "sp-db-id-123",
    siteUuid: "site-123",
    polygonUuid: "polygon-123",
    isActive: true,
    deletedAt: null,
    site: {
      uuid: "site-123",
      frameworkKey: "ppc",
      projectId: 1
    }
  },
  sitePolygons: [
    { polygonUuid: "polygon-123", isActive: true, deletedAt: null },
    { polygonUuid: "polygon-456", isActive: true, deletedAt: null }
  ],
  project: {
    uuid: "project-123",
    id: 1,
    frameworkKey: "ppc",
    organisationId: 1,
    status: "active"
  },
  projectPitch: {
    uuid: "pitch-123",
    id: 2,
    organisationId: 1
  },
  projectPolygons: [{ polyUuid: "polygon-123" }, { polyUuid: "polygon-456" }],
  projectSites: [{ uuid: "site-123" }, { uuid: "site-456" }],
  projectSitePolygons: [{ polygonUuid: "polygon-123" }, { polygonUuid: "polygon-456" }],
  countryEnvelope: [
    {
      envelope: JSON.stringify({
        type: "Polygon",
        coordinates: [
          [
            [-125.0, 24.0],
            [-125.0, 49.0],
            [-66.0, 49.0],
            [-66.0, 24.0],
            [-125.0, 24.0]
          ]
        ]
      })
    }
  ],
  landscapes: {
    ikr: createKiruLandscapeEnvelopeModel()
  }
};

describe("BoundingBoxService", () => {
  let service: BoundingBoxService;
  let dataApiService: DataApiService;

  const mockDataApiService = {
    getCountryEnvelope: jest.fn()
  };

  const mockConfigService = {
    get: jest.fn()
  };

  const mockPolicyService = {
    authorize: jest.fn()
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BoundingBoxService,
        {
          provide: DataApiService,
          useValue: mockDataApiService
        },
        {
          provide: ConfigService,
          useValue: mockConfigService
        },
        {
          provide: PolicyService,
          useValue: mockPolicyService
        }
      ]
    }).compile();

    service = module.get<BoundingBoxService>(BoundingBoxService);
    dataApiService = module.get<DataApiService>(DataApiService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("getPolygonBoundingBox", () => {
    it("should return a bounding box for a valid polygon UUID", async () => {
      const polygonUuid = fixtures.polygon.uuid;

      // Setup mocks - service only needs to verify polygon exists and get bounding box
      (PolygonGeometry.findOne as jest.Mock).mockResolvedValue({ uuid: polygonUuid });
      (PolygonGeometry.findAll as jest.Mock).mockResolvedValue([fixtures.polygon.envelope]);

      const result = await service.getPolygonBoundingBox(polygonUuid);

      // Verify the polygon exists check
      expect(PolygonGeometry.findOne).toHaveBeenCalledWith({
        where: { uuid: polygonUuid },
        attributes: ["uuid"]
      });

      // Verify the bounding box query
      expect(PolygonGeometry.findAll).toHaveBeenCalledWith({
        where: { uuid: polygonUuid },
        attributes: [[Sequelize.fn("ST_ASGEOJSON", Sequelize.fn("ST_Envelope", Sequelize.col("geom"))), "envelope"]]
      });

      // SitePolygon validation is handled by controller, not service
      expect(SitePolygon.findOne).not.toHaveBeenCalled();

      expect(result).toBeDefined();
      expect(result.bbox).toEqual([-74.006, 40.7128, -73.9538, 40.8075]);
    });

    it("should throw NotFoundException when polygon is not found", async () => {
      const nonExistentUuid = "non-existent-uuid";
      (PolygonGeometry.findOne as jest.Mock).mockResolvedValue(null);

      await expect(service.getPolygonBoundingBox(nonExistentUuid)).rejects.toThrow(
        new NotFoundException(`Polygon with UUID ${nonExistentUuid} not found`)
      );

      expect(PolygonGeometry.findOne).toHaveBeenCalled();
      expect(SitePolygon.findOne).not.toHaveBeenCalled();
    });
  });

  describe("getSiteBoundingBox", () => {
    it("should return a bounding box for a site with multiple polygons", async () => {
      const siteUuid = fixtures.site.uuid;
      (Site.findOne as jest.Mock).mockResolvedValue(fixtures.site);
      (SitePolygon.findAll as jest.Mock).mockResolvedValue(fixtures.sitePolygons);
      (PolygonGeometry.findAll as jest.Mock).mockResolvedValue([fixtures.polygon.envelope, fixtures.polygon2.envelope]);

      const result = await service.getSiteBoundingBox(siteUuid);

      expect(Site.findOne).toHaveBeenCalledWith({
        where: { uuid: siteUuid },
        attributes: ["uuid", "frameworkKey", "projectId"]
      });

      expect(SitePolygon.findAll).toHaveBeenCalledWith({
        where: {
          siteUuid,
          polygonUuid: { [Op.ne]: "" },
          isActive: true,
          deletedAt: null
        },
        attributes: ["polygonUuid"]
      });

      expect(PolygonGeometry.findAll).toHaveBeenCalledWith({
        where: {
          uuid: { [Op.in]: fixtures.sitePolygons.map(sp => sp.polygonUuid) }
        },
        attributes: [[Sequelize.fn("ST_ASGEOJSON", Sequelize.fn("ST_Envelope", Sequelize.col("geom"))), "envelope"]]
      });

      // The expected bounding box should encompass both NY and SF
      expect(result).toBeDefined();
      expect(result.bbox).toEqual([-122.4194, 37.7749, -73.9538, 40.8075]);
    });

    it("should throw NotFoundException when site is not found", async () => {
      const nonExistentUuid = "non-existent-site";
      (Site.findOne as jest.Mock).mockResolvedValue(null);

      await expect(service.getSiteBoundingBox(nonExistentUuid)).rejects.toThrow(
        new NotFoundException(`Site with UUID ${nonExistentUuid} not found`)
      );

      expect(Site.findOne).toHaveBeenCalled();
      expect(SitePolygon.findAll).not.toHaveBeenCalled();
    });

    it("should throw NotFoundException when site has no polygons", async () => {
      const siteUuid = fixtures.site.uuid;
      (Site.findOne as jest.Mock).mockResolvedValue(fixtures.site);
      (SitePolygon.findAll as jest.Mock).mockResolvedValue([]);

      await expect(service.getSiteBoundingBox(siteUuid)).rejects.toThrow(
        new NotFoundException(`No polygons found for site with UUID ${siteUuid}`)
      );

      expect(Site.findOne).toHaveBeenCalled();
      expect(SitePolygon.findAll).toHaveBeenCalled();
      expect(PolygonGeometry.findAll).not.toHaveBeenCalled();
    });
  });

  describe("getProjectBoundingBox", () => {
    it("should return a bounding box for a project with multiple sites and polygons", async () => {
      const projectUuid = fixtures.project.uuid;
      (Project.findOne as jest.Mock).mockResolvedValue(fixtures.project);
      (Site.findAll as jest.Mock).mockResolvedValue(fixtures.projectSites);
      (SitePolygon.findAll as jest.Mock).mockResolvedValue(fixtures.projectSitePolygons);
      (PolygonGeometry.findAll as jest.Mock).mockResolvedValue([fixtures.polygon.envelope, fixtures.polygon2.envelope]);

      const result = await service.getProjectBoundingBox(projectUuid);

      expect(Project.findOne).toHaveBeenCalledWith({
        where: { uuid: projectUuid },
        attributes: ["id", "uuid", "frameworkKey", "organisationId", "status"]
      });

      expect(Site.findAll).toHaveBeenCalledWith({
        where: { projectId: fixtures.project.id },
        attributes: ["uuid"]
      });

      expect(SitePolygon.findAll).toHaveBeenCalledWith({
        where: {
          siteUuid: { [Op.in]: fixtures.projectSites.map(site => site.uuid) },
          polygonUuid: { [Op.ne]: "" }
        },
        attributes: ["polygonUuid"]
      });

      expect(PolygonGeometry.findAll).toHaveBeenCalledWith({
        where: {
          uuid: { [Op.in]: fixtures.projectSitePolygons.map(sp => sp.polygonUuid) }
        },
        attributes: [[Sequelize.fn("ST_ASGEOJSON", Sequelize.fn("ST_Envelope", Sequelize.col("geom"))), "envelope"]]
      });

      expect(result).toBeDefined();
      expect(result.bbox).toEqual([-122.4194, 37.7749, -73.9538, 40.8075]);
    });

    it("should throw NotFoundException when project is not found", async () => {
      const nonExistentUuid = "non-existent-project";
      (Project.findOne as jest.Mock).mockResolvedValue(null);

      await expect(service.getProjectBoundingBox(nonExistentUuid)).rejects.toThrow(
        new NotFoundException(`Project with UUID ${nonExistentUuid} not found`)
      );

      expect(Project.findOne).toHaveBeenCalled();
      expect(Site.findAll).not.toHaveBeenCalled();
    });

    it("should throw NotFoundException when project has no sites", async () => {
      const projectUuid = fixtures.project.uuid;
      (Project.findOne as jest.Mock).mockResolvedValue(fixtures.project);
      (Site.findAll as jest.Mock).mockResolvedValue([]);

      await expect(service.getProjectBoundingBox(projectUuid)).rejects.toThrow(
        new NotFoundException(`No sites found for project with UUID ${projectUuid}`)
      );

      expect(Project.findOne).toHaveBeenCalled();
      expect(Site.findAll).toHaveBeenCalled();
      expect(SitePolygon.findAll).not.toHaveBeenCalled();
    });

    it("should throw NotFoundException when project sites have no polygons", async () => {
      const projectUuid = fixtures.project.uuid;
      (Project.findOne as jest.Mock).mockResolvedValue(fixtures.project);
      (Site.findAll as jest.Mock).mockResolvedValue(fixtures.projectSites);
      (SitePolygon.findAll as jest.Mock).mockResolvedValue([]);

      await expect(service.getProjectBoundingBox(projectUuid)).rejects.toThrow(
        new NotFoundException(`No polygons found for project with UUID ${projectUuid}`)
      );

      expect(Project.findOne).toHaveBeenCalled();
      expect(Site.findAll).toHaveBeenCalled();
      expect(SitePolygon.findAll).toHaveBeenCalled();
      expect(PolygonGeometry.findAll).not.toHaveBeenCalled();
    });
  });

  describe("getProjectPitchBoundingBox", () => {
    it("should return a bounding box for a project pitch with multiple polygons", async () => {
      const projectPitchUuid = fixtures.projectPitch.uuid;
      (ProjectPitch.findOne as jest.Mock).mockResolvedValue(fixtures.projectPitch);
      (ProjectPolygon.findAll as jest.Mock).mockResolvedValue(fixtures.projectPolygons);
      (PolygonGeometry.findAll as jest.Mock).mockResolvedValue([fixtures.polygon.envelope, fixtures.polygon2.envelope]);

      const result = await service.getProjectPitchBoundingBox(projectPitchUuid);

      expect(ProjectPitch.findOne).toHaveBeenCalledWith({
        where: { uuid: projectPitchUuid },
        attributes: ["id", "uuid", "organisationId"]
      });

      expect(ProjectPolygon.findAll).toHaveBeenCalledWith({
        where: {
          entityType: ProjectPolygon.LARAVEL_TYPE_PROJECT_PITCH,
          entityId: fixtures.projectPitch.id
        },
        attributes: ["polyUuid"]
      });

      expect(PolygonGeometry.findAll).toHaveBeenCalledWith({
        where: {
          uuid: { [Op.in]: fixtures.projectPolygons.map(pp => pp.polyUuid) }
        },
        attributes: [[Sequelize.fn("ST_ASGEOJSON", Sequelize.fn("ST_Envelope", Sequelize.col("geom"))), "envelope"]]
      });

      expect(result).toBeDefined();
      expect(result.bbox).toEqual([-122.4194, 37.7749, -73.9538, 40.8075]);
    });

    it("should throw NotFoundException when project pitch is not found", async () => {
      const nonExistentUuid = "non-existent-pitch";
      (ProjectPitch.findOne as jest.Mock).mockResolvedValue(null);

      await expect(service.getProjectPitchBoundingBox(nonExistentUuid)).rejects.toThrow(
        new NotFoundException(`ProjectPitch with UUID ${nonExistentUuid} not found`)
      );

      expect(ProjectPitch.findOne).toHaveBeenCalled();
      expect(ProjectPolygon.findAll).not.toHaveBeenCalled();
    });

    it("should throw NotFoundException when project pitch has no polygons", async () => {
      const projectPitchUuid = fixtures.projectPitch.uuid;
      (ProjectPitch.findOne as jest.Mock).mockResolvedValue(fixtures.projectPitch);
      (ProjectPolygon.findAll as jest.Mock).mockResolvedValue([]);

      await expect(service.getProjectPitchBoundingBox(projectPitchUuid)).rejects.toThrow(
        new NotFoundException(`No polygons found for project pitch with UUID ${projectPitchUuid}`)
      );

      expect(ProjectPitch.findOne).toHaveBeenCalled();
      expect(ProjectPolygon.findAll).toHaveBeenCalled();
      expect(PolygonGeometry.findAll).not.toHaveBeenCalled();
    });
  });

  describe("getCountryLandscapeBoundingBox", () => {
    it("should return a bounding box for a country", async () => {
      const country = "US";
      mockDataApiService.getCountryEnvelope.mockResolvedValue(fixtures.countryEnvelope);

      const result = await service.getCountryLandscapeBoundingBox(country, []);

      expect(dataApiService.getCountryEnvelope).toHaveBeenCalledWith("US");
      expect(result).toBeDefined();
      expect(result.bbox).toEqual([-125.0, 24.0, -66.0, 49.0]);
    });

    it("should return a bounding box for landscapes", async () => {
      const landscapes = ["ikr"];
      (LandscapeGeometry.findAll as jest.Mock).mockResolvedValue([fixtures.landscapes.ikr]);

      const result = await service.getCountryLandscapeBoundingBox("", landscapes);

      expect(LandscapeGeometry.findAll).toHaveBeenCalledWith({
        where: { slug: { [Op.in]: landscapes } },
        attributes: [[Sequelize.fn("ST_ASGEOJSON", Sequelize.fn("ST_Envelope", Sequelize.col("geometry"))), "envelope"]]
      });

      const kiruEnvelope = JSON.parse(fixtures.landscapes.ikr.get("envelope") as string);
      const coords = kiruEnvelope.coordinates[0];
      const minLng = Math.min(...coords.map(p => p[0]));
      const minLat = Math.min(...coords.map(p => p[1]));
      const maxLng = Math.max(...coords.map(p => p[0]));
      const maxLat = Math.max(...coords.map(p => p[1]));

      expect(result).toBeDefined();
      expect(result.bbox).toEqual([minLng, minLat, maxLng, maxLat]);
    });

    it("should handle both country and landscapes together", async () => {
      const country = "US";
      const landscapes = ["ikr"];

      mockDataApiService.getCountryEnvelope.mockResolvedValue(fixtures.countryEnvelope);
      (LandscapeGeometry.findAll as jest.Mock).mockResolvedValue([fixtures.landscapes.ikr]);

      const result = await service.getCountryLandscapeBoundingBox(country, landscapes);

      expect(dataApiService.getCountryEnvelope).toHaveBeenCalledWith("US");
      expect(LandscapeGeometry.findAll).toHaveBeenCalledWith({
        where: { slug: { [Op.in]: landscapes } },
        attributes: [[Sequelize.fn("ST_ASGEOJSON", Sequelize.fn("ST_Envelope", Sequelize.col("geometry"))), "envelope"]]
      });

      const kiruEnvelope = JSON.parse(fixtures.landscapes.ikr.get("envelope") as string);
      const kiruCoords = kiruEnvelope.coordinates[0];
      const kiruMinLng = Math.min(...kiruCoords.map(p => p[0]));
      const kiruMinLat = Math.min(...kiruCoords.map(p => p[1]));
      const kiruMaxLng = Math.max(...kiruCoords.map(p => p[0]));
      const kiruMaxLat = Math.max(...kiruCoords.map(p => p[1]));

      expect(result).toBeDefined();
      expect(result.bbox).toEqual([
        Math.min(-125.0, kiruMinLng),
        Math.min(24.0, kiruMinLat),
        Math.max(-66.0, kiruMaxLng),
        Math.max(49.0, kiruMaxLat)
      ]);
    });

    it("should handle landscape errors if country is provided", async () => {
      const country = "US";
      const landscapes = ["ikr"];

      mockDataApiService.getCountryEnvelope.mockResolvedValue(fixtures.countryEnvelope);
      (LandscapeGeometry.findAll as jest.Mock).mockRejectedValue(new NotFoundException("Landscape DB error"));

      const result = await service.getCountryLandscapeBoundingBox(country, landscapes);

      expect(result).toBeDefined();
      expect(result.bbox).toEqual([-125.0, 24.0, -66.0, 49.0]);
    });

    it("should handle JSON parsing errors and fall back to country data", async () => {
      const country = "US";
      const landscapes = ["ikr"];

      mockDataApiService.getCountryEnvelope.mockResolvedValue([
        {
          envelope: "{invalid-json"
        }
      ]);

      // But the landscape data is available
      (LandscapeGeometry.findAll as jest.Mock).mockResolvedValue([fixtures.landscapes.ikr]);

      // Should still work because landscape envelope is available
      const result = await service.getCountryLandscapeBoundingBox(country, landscapes);

      // Result should contain just the landscape data
      const kiruEnvelope = JSON.parse(fixtures.landscapes.ikr.get("envelope") as string);
      const coords = kiruEnvelope.coordinates[0];
      const minLng = Math.min(...coords.map(p => p[0]));
      const minLat = Math.min(...coords.map(p => p[1]));
      const maxLng = Math.max(...coords.map(p => p[0]));
      const maxLat = Math.max(...coords.map(p => p[1]));

      expect(result).toBeDefined();
      expect(result.bbox).toEqual([minLng, minLat, maxLng, maxLat]);
    });

    it("should handle API errors when landscapes are available", async () => {
      const country = "US";
      const landscapes = ["ikr"];

      // Mock an API error
      mockDataApiService.getCountryEnvelope.mockRejectedValue(new Error("API error"));

      // But the landscape data is available
      (LandscapeGeometry.findAll as jest.Mock).mockResolvedValue([fixtures.landscapes.ikr]);

      // Should still work because landscape envelope is available
      const result = await service.getCountryLandscapeBoundingBox(country, landscapes);

      // Result should contain just the landscape data
      const kiruEnvelope = JSON.parse(fixtures.landscapes.ikr.get("envelope") as string);
      const coords = kiruEnvelope.coordinates[0];
      const minLng = Math.min(...coords.map(p => p[0]));
      const minLat = Math.min(...coords.map(p => p[1]));
      const maxLng = Math.max(...coords.map(p => p[0]));
      const maxLat = Math.max(...coords.map(p => p[1]));

      expect(result).toBeDefined();
      expect(result.bbox).toEqual([minLng, minLat, maxLng, maxLat]);
    });

    it("should propagate API errors when no landscape data is available", async () => {
      const country = "US";
      const apiError = new Error("API error");

      mockDataApiService.getCountryEnvelope.mockRejectedValue(apiError);
      (LandscapeGeometry.findAll as jest.Mock).mockResolvedValue([]);

      await expect(service.getCountryLandscapeBoundingBox(country, [])).rejects.toThrow(apiError);
    });

    it("should throw NotFoundException when no valid params are provided", async () => {
      await expect(service.getCountryLandscapeBoundingBox("", [])).rejects.toThrow(
        new NotFoundException("No valid bounding box found. Please provide valid country code or landscape names.")
      );
    });
  });
});

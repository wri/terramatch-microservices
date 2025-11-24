import { Test, TestingModule } from "@nestjs/testing";
import { SitePolygonCreationService } from "./site-polygon-creation.service";
import { PolygonGeometryCreationService } from "./polygon-geometry-creation.service";
import { PointGeometryCreationService } from "./point-geometry-creation.service";
import { SitePolygonVersioningService } from "./site-polygon-versioning.service";
import { DuplicateGeometryValidator } from "../validations/validators/duplicate-geometry.validator";
import { VoronoiService } from "../voronoi/voronoi.service";
import { SitePolygon } from "@terramatch-microservices/database/entities";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { AttributeChangesDto } from "./dto/create-site-polygon-request.dto";
import { Transaction } from "sequelize";

const mockTransaction = {
  commit: jest.fn(),
  rollback: jest.fn(),
  afterCommit: jest.fn(),
  LOCK: {}
} as unknown as Transaction;

describe("SitePolygonCreationService - Versioning", () => {
  let service: SitePolygonCreationService;
  let polygonGeometryService: PolygonGeometryCreationService;
  let versioningService: SitePolygonVersioningService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SitePolygonCreationService,
        {
          provide: PolygonGeometryCreationService,
          useValue: {
            createGeometriesFromFeatures: jest.fn(),
            bulkUpdateSitePolygonCentroids: jest.fn().mockResolvedValue(undefined),
            bulkUpdateSitePolygonAreas: jest.fn().mockResolvedValue(undefined),
            bulkUpdateProjectCentroids: jest.fn().mockResolvedValue(undefined)
          }
        },
        {
          provide: PointGeometryCreationService,
          useValue: {
            createPointGeometriesFromFeatures: jest.fn()
          }
        },
        {
          provide: DuplicateGeometryValidator,
          useValue: {
            checkNewFeaturesDuplicates: jest.fn()
          }
        },
        {
          provide: VoronoiService,
          useValue: {
            transformPointsToPolygons: jest.fn()
          }
        },
        {
          provide: SitePolygonVersioningService,
          useValue: {
            validateVersioningEligibility: jest.fn(),
            createVersion: jest.fn()
          }
        }
      ]
    }).compile();

    service = module.get<SitePolygonCreationService>(SitePolygonCreationService);
    polygonGeometryService = module.get<PolygonGeometryCreationService>(PolygonGeometryCreationService);
    versioningService = module.get<SitePolygonVersioningService>(SitePolygonVersioningService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("createSitePolygonVersion", () => {
    const baseSitePolygonUuid = "base-polygon-uuid";
    const userId = 123;
    const userFullName = "Test User";
    const source = "terramatch";
    const changeReason = "Updated polygon boundary";

    it("should throw NotFoundException when base polygon does not exist", async () => {
      jest
        .spyOn(versioningService, "validateVersioningEligibility")
        .mockRejectedValue(new NotFoundException("Site polygon not found"));

      await expect(
        service.createSitePolygonVersion(
          baseSitePolygonUuid,
          undefined,
          { polyName: "New Name" },
          changeReason,
          userId,
          userFullName,
          source,
          mockTransaction
        )
      ).rejects.toThrow(NotFoundException);
    });

    it("should create version with geometry change only", async () => {
      const basePolygon = {
        uuid: baseSitePolygonUuid,
        primaryUuid: "primary-uuid",
        polyName: "Original Name",
        siteUuid: "site-uuid",
        status: "approved"
      } as SitePolygon;

      const newGeometry = [
        {
          type: "FeatureCollection" as const,
          features: [
            {
              type: "Feature" as const,
              geometry: {
                type: "Polygon" as const,
                coordinates: [
                  [
                    [0, 0],
                    [0, 1],
                    [1, 1],
                    [1, 0],
                    [0, 0]
                  ]
                ]
              },
              properties: {
                site_id: "site-uuid"
              }
            }
          ]
        }
      ];

      const newVersionUuid = "new-version-uuid";
      const newGeometryUuid = "new-geometry-uuid";

      jest.spyOn(versioningService, "validateVersioningEligibility").mockResolvedValue(basePolygon);
      jest.spyOn(polygonGeometryService, "createGeometriesFromFeatures").mockResolvedValue({
        uuids: [newGeometryUuid],
        areas: [2.5]
      });
      jest.spyOn(versioningService, "createVersion").mockResolvedValue({
        uuid: newVersionUuid,
        primaryUuid: "primary-uuid",
        polygonUuid: newGeometryUuid,
        status: "draft"
      } as SitePolygon);

      const result = await service.createSitePolygonVersion(
        baseSitePolygonUuid,
        newGeometry,
        undefined,
        changeReason,
        userId,
        userFullName,
        source,
        mockTransaction
      );

      expect(result.uuid).toBe(newVersionUuid);
      expect(versioningService.createVersion).toHaveBeenCalledWith(
        basePolygon,
        expect.objectContaining({
          calcArea: 2.5,
          status: "draft"
        }),
        newGeometryUuid,
        userId,
        expect.stringContaining(changeReason),
        userFullName,
        mockTransaction
      );
      expect(polygonGeometryService.bulkUpdateSitePolygonCentroids).toHaveBeenCalledWith(
        [newGeometryUuid],
        mockTransaction
      );
    });

    it("should create version with attribute changes only (no geometry)", async () => {
      const basePolygon = {
        uuid: baseSitePolygonUuid,
        primaryUuid: "primary-uuid",
        polyName: "Original Name",
        numTrees: 100,
        polygonUuid: "existing-geometry-uuid"
      } as SitePolygon;

      const attributeChanges: AttributeChangesDto = {
        polyName: "Updated Name",
        numTrees: 150
      };

      const newVersionUuid = "new-version-uuid";

      jest.spyOn(versioningService, "validateVersioningEligibility").mockResolvedValue(basePolygon);
      jest.spyOn(versioningService, "createVersion").mockResolvedValue({
        uuid: newVersionUuid,
        primaryUuid: "primary-uuid",
        polygonUuid: "existing-geometry-uuid",
        polyName: "Updated Name",
        numTrees: 150,
        status: "draft"
      } as SitePolygon);

      const result = await service.createSitePolygonVersion(
        baseSitePolygonUuid,
        undefined, // No geometry
        attributeChanges,
        changeReason,
        userId,
        userFullName,
        source,
        mockTransaction
      );

      expect(result.uuid).toBe(newVersionUuid);
      expect(versioningService.createVersion).toHaveBeenCalledWith(
        basePolygon,
        expect.objectContaining({
          polyName: "Updated Name",
          numTrees: 150,
          status: "draft"
        }),
        null, // No new geometry UUID
        userId,
        expect.any(String),
        userFullName,
        mockTransaction
      );
      expect(polygonGeometryService.createGeometriesFromFeatures).not.toHaveBeenCalled();
    });

    it("should create version with both geometry and attribute changes", async () => {
      const basePolygon = {
        uuid: baseSitePolygonUuid,
        primaryUuid: "primary-uuid",
        polyName: "Original Name",
        numTrees: 100
      } as SitePolygon;

      const newGeometry = [
        {
          type: "FeatureCollection" as const,
          features: [
            {
              type: "Feature" as const,
              geometry: {
                type: "Polygon" as const,
                coordinates: [
                  [
                    [0, 0],
                    [0, 1],
                    [1, 1],
                    [1, 0],
                    [0, 0]
                  ]
                ]
              },
              properties: {
                site_id: "site-uuid"
              }
            }
          ]
        }
      ];

      const attributeChanges: AttributeChangesDto = {
        polyName: "Updated Name"
      };

      jest.spyOn(versioningService, "validateVersioningEligibility").mockResolvedValue(basePolygon);
      jest.spyOn(polygonGeometryService, "createGeometriesFromFeatures").mockResolvedValue({
        uuids: ["new-geometry-uuid"],
        areas: [3.0]
      });
      jest.spyOn(versioningService, "createVersion").mockResolvedValue({
        uuid: "new-version-uuid",
        primaryUuid: "primary-uuid",
        polyName: "Updated Name",
        status: "draft"
      } as SitePolygon);

      const result = await service.createSitePolygonVersion(
        baseSitePolygonUuid,
        newGeometry,
        attributeChanges,
        changeReason,
        userId,
        userFullName,
        source,
        mockTransaction
      );

      expect(result).toBeDefined();
      expect(versioningService.createVersion).toHaveBeenCalledWith(
        basePolygon,
        expect.objectContaining({
          polyName: "Updated Name",
          calcArea: 3.0,
          status: "draft"
        }),
        "new-geometry-uuid",
        userId,
        expect.any(String),
        userFullName,
        mockTransaction
      );
    });

    it("should throw BadRequestException when multiple features provided", async () => {
      const basePolygon = {
        uuid: baseSitePolygonUuid,
        primaryUuid: "primary-uuid"
      } as SitePolygon;

      const multipleFeatures = [
        {
          type: "FeatureCollection" as const,
          features: [
            {
              type: "Feature" as const,
              geometry: { type: "Polygon" as const, coordinates: [[[]]] },
              properties: {
                site_id: "site-uuid"
              }
            },
            {
              type: "Feature" as const,
              geometry: { type: "Polygon" as const, coordinates: [[[]]] },
              properties: {
                site_id: "site-uuid"
              }
            }
          ]
        }
      ];

      jest.spyOn(versioningService, "validateVersioningEligibility").mockResolvedValue(basePolygon);

      await expect(
        service.createSitePolygonVersion(
          baseSitePolygonUuid,
          multipleFeatures,
          undefined,
          changeReason,
          userId,
          userFullName,
          source,
          mockTransaction
        )
      ).rejects.toThrow(BadRequestException);
    });

    it("should ignore empty string attribute values", async () => {
      const basePolygon = {
        uuid: baseSitePolygonUuid,
        primaryUuid: "primary-uuid",
        polyName: "Original Name",
        practice: ["agroforestry"]
      } as unknown as SitePolygon;

      const attributeChanges: AttributeChangesDto = {
        polyName: "Updated Name",
        practice: [], // Empty array should be ignored
        numTrees: 0
      };

      jest.spyOn(versioningService, "validateVersioningEligibility").mockResolvedValue(basePolygon);
      jest.spyOn(versioningService, "createVersion").mockResolvedValue({
        uuid: "new-version-uuid"
      } as SitePolygon);

      await service.createSitePolygonVersion(
        baseSitePolygonUuid,
        undefined,
        attributeChanges,
        changeReason,
        userId,
        userFullName,
        source,
        mockTransaction
      );

      const createVersionCall = (versioningService.createVersion as jest.Mock).mock.calls[0];
      const appliedAttributes = createVersionCall[1];

      expect(appliedAttributes.polyName).toBe("Updated Name");
      expect(appliedAttributes.practice).toBeUndefined(); // Empty array ignored
      expect(appliedAttributes.numTrees).toBe(0);
    });

    it("should always set status to draft", async () => {
      const basePolygon = {
        uuid: baseSitePolygonUuid,
        primaryUuid: "primary-uuid",
        status: "approved"
      } as SitePolygon;

      jest.spyOn(versioningService, "validateVersioningEligibility").mockResolvedValue(basePolygon);
      jest.spyOn(versioningService, "createVersion").mockResolvedValue({
        uuid: "new-version-uuid",
        status: "draft"
      } as SitePolygon);

      await service.createSitePolygonVersion(
        baseSitePolygonUuid,
        undefined,
        { polyName: "Test" },
        changeReason,
        userId,
        userFullName,
        source,
        mockTransaction
      );

      const createVersionCall = (versioningService.createVersion as jest.Mock).mock.calls[0];
      const appliedAttributes = createVersionCall[1];

      expect(appliedAttributes.status).toBe("draft");
    });
  });

  describe("buildDetailedChangeDescription", () => {
    it("should describe geometry changes", () => {
      const basePolygon = { uuid: "test", polyName: "Test" } as SitePolygon;
      const changes = {};
      const geometryChanged = true;

      const description = service["buildDetailedChangeDescription"](basePolygon, changes, geometryChanged);

      expect(description).toContain("Geometry updated");
    });

    it("should describe attribute changes", () => {
      const basePolygon = { uuid: "test", polyName: "Old Name", numTrees: 100 } as SitePolygon;
      const changes = { polyName: "New Name", numTrees: 150 };

      const description = service["buildDetailedChangeDescription"](basePolygon, changes, false);

      expect(description).toContain("polyName");
      expect(description).toContain("Old Name");
      expect(description).toContain("New Name");
      expect(description).toContain("numTrees");
    });

    it("should combine geometry and attribute changes", () => {
      const basePolygon = { uuid: "test", polyName: "Old" } as SitePolygon;
      const changes = { polyName: "New" };

      const description = service["buildDetailedChangeDescription"](basePolygon, changes, true);

      expect(description).toContain("Geometry updated");
      expect(description).toContain("polyName");
    });

    it("should not track status in description", () => {
      const basePolygon = { uuid: "test", status: "approved" } as SitePolygon;
      const changes = { status: "draft" };

      const description = service["buildDetailedChangeDescription"](basePolygon, changes, false);

      expect(description).not.toContain("status");
    });

    it("should return default message when no changes", () => {
      const basePolygon = { uuid: "test" } as SitePolygon;
      const changes = {};

      const description = service["buildDetailedChangeDescription"](basePolygon, changes, false);

      expect(description).toBe("Version created");
    });
  });
});

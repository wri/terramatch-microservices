import { Test, TestingModule } from "@nestjs/testing";
import { SitePolygonVersioningService } from "./site-polygon-versioning.service";
import { SitePolygon, PolygonUpdates, PolygonGeometry } from "@terramatch-microservices/database/entities";
import { NotFoundException, BadRequestException } from "@nestjs/common";

const mockTransaction = {
  commit: jest.fn(),
  rollback: jest.fn()
} as any;

describe("SitePolygonVersioningService", () => {
  let service: SitePolygonVersioningService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SitePolygonVersioningService]
    }).compile();

    service = module.get<SitePolygonVersioningService>(SitePolygonVersioningService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("generateVersionName", () => {
    it("should generate version name with polygon name and user", () => {
      const result = service.generateVersionName("Test_Polygon", "John Doe");

      expect(result).toContain("Test_Polygon");
      expect(result).toContain("John_Doe");
      expect(result).toMatch(/_\d+_[A-Za-z]+_\d{4}_\d{2}_\d{2}_\d{2}/); // Contains date and time
    });

    it("should handle null polygon name", () => {
      const result = service.generateVersionName(null, "Jane Smith");

      expect(result).toContain("Unnamed");
      expect(result).toContain("Jane_Smith");
    });

    it("should handle null user name", () => {
      const result = service.generateVersionName("My_Polygon", null);

      expect(result).toContain("My_Polygon");
      expect(result).not.toContain("_null");
    });

    it("should match V2 format exactly", () => {
      const now = new Date("2025-11-10T14:30:45Z");
      jest.useFakeTimers().setSystemTime(now);

      const result = service.generateVersionName("Field_A", "Admin User");

      expect(result).toBe("Field_A_10_November_2025_14_30_45_Admin_User");

      jest.useRealTimers();
    });
  });

  describe("buildChangeDescription", () => {
    it("should build description for single field change", () => {
      const oldValues = { polyName: "Old Name" as any };
      const newValues = { polyName: "New Name" as any };

      const result = service.buildChangeDescription(oldValues, newValues);

      expect(result).toBe("polyName => from Old Name to New Name");
    });

    it("should build description for multiple field changes", () => {
      const oldValues = { polyName: "Old" as any, numTrees: 100 as any };
      const newValues = { polyName: "New" as any, numTrees: 150 as any };

      const result = service.buildChangeDescription(oldValues, newValues);

      expect(result).toContain("polyName => from Old to New");
      expect(result).toContain("numTrees => from 100 to 150");
    });

    it("should handle null values", () => {
      const oldValues = { numTrees: null as any };
      const newValues = { numTrees: 50 as any };

      const result = service.buildChangeDescription(oldValues, newValues);

      expect(result).toBe("numTrees => from null to 50");
    });

    it("should return default message when no changes", () => {
      const oldValues = { polyName: "Same" as any };
      const newValues = { polyName: "Same" as any };

      const result = service.buildChangeDescription(oldValues, newValues);

      expect(result).toBe("No attribute changes");
    });
  });

  describe("createVersion", () => {
    it("should throw NotFoundException when base polygon does not exist", async () => {
      jest.spyOn(SitePolygon, "findOne").mockResolvedValue(null);

      await expect(
        service.createVersion("non-existent-uuid", {}, null, 1, "Test change", "Test User", mockTransaction)
      ).rejects.toThrow(NotFoundException);
    });

    it("should create new version with correct attributes", async () => {
      const basePrimaryUuid = "base-primary-uuid";
      const basePolygon = {
        uuid: "base-uuid",
        primaryUuid: basePrimaryUuid,
        polyName: "Original Name",
        numTrees: 100,
        status: "draft",
        siteUuid: "site-uuid",
        isActive: true,
        get: jest.fn().mockReturnValue({
          uuid: "base-uuid",
          primaryUuid: basePrimaryUuid,
          polyName: "Original Name",
          numTrees: 100,
          status: "draft",
          siteUuid: "site-uuid",
          isActive: true
        })
      } as any;

      jest.spyOn(SitePolygon, "findOne").mockResolvedValue(basePolygon);
      jest.spyOn(SitePolygon, "create").mockResolvedValue({ uuid: "new-version-uuid" } as any);
      jest.spyOn(SitePolygon, "update").mockResolvedValue([1, []] as any);
      jest.spyOn(PolygonUpdates, "create").mockResolvedValue({} as any);

      const result = await service.createVersion(
        "base-uuid",
        { polyName: "Updated Name" },
        "new-geometry-uuid",
        1,
        "Updated polygon name",
        "Admin User",
        mockTransaction
      );

      expect(result.uuid).toBe("new-version-uuid");
      expect(SitePolygon.create).toHaveBeenCalledWith(
        expect.objectContaining({
          primaryUuid: basePrimaryUuid,
          polyName: "Updated Name",
          polygonUuid: "new-geometry-uuid",
          isActive: true
        }),
        { transaction: mockTransaction }
      );
    });

    it("should deactivate other versions when creating new version", async () => {
      const basePrimaryUuid = "base-primary-uuid";
      const basePolygon = {
        uuid: "base-uuid",
        primaryUuid: basePrimaryUuid,
        get: jest.fn().mockReturnValue({ uuid: "base-uuid", primaryUuid: basePrimaryUuid })
      } as any;

      jest.spyOn(SitePolygon, "findOne").mockResolvedValue(basePolygon);
      jest.spyOn(SitePolygon, "create").mockResolvedValue({ uuid: "new-uuid" } as any);
      const updateSpy = jest.spyOn(SitePolygon, "update").mockResolvedValue([2, []] as any);
      jest.spyOn(PolygonUpdates, "create").mockResolvedValue({} as any);

      await service.createVersion("base-uuid", {}, null, 1, "Test", null, mockTransaction);

      expect(updateSpy).toHaveBeenCalledWith(
        { isActive: false },
        expect.objectContaining({
          where: expect.objectContaining({
            primaryUuid: basePrimaryUuid
          }),
          transaction: mockTransaction
        })
      );
    });

    it("should track change in polygon_updates table", async () => {
      const basePolygon = {
        uuid: "base-uuid",
        primaryUuid: "primary-uuid",
        get: jest.fn().mockReturnValue({ uuid: "base-uuid", primaryUuid: "primary-uuid" })
      } as any;

      jest.spyOn(SitePolygon, "findOne").mockResolvedValue(basePolygon);
      jest.spyOn(SitePolygon, "create").mockResolvedValue({ uuid: "new-uuid" } as any);
      jest.spyOn(SitePolygon, "update").mockResolvedValue([1, []] as any);
      const trackChangeSpy = jest.spyOn(PolygonUpdates, "create").mockResolvedValue({} as any);

      await service.createVersion("base-uuid", {}, null, 123, "Geometry updated", "Test User", mockTransaction);

      expect(trackChangeSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          sitePolygonUuid: "primary-uuid",
          change: "Geometry updated",
          updatedById: 123,
          type: "update"
        }),
        { transaction: mockTransaction }
      );
    });
  });

  describe("trackChange", () => {
    it("should create polygon update record with correct data", async () => {
      const createSpy = jest.spyOn(PolygonUpdates, "create").mockResolvedValue({} as any);

      await service.trackChange(
        "primary-uuid",
        "Version_1",
        "Test change description",
        456,
        "update",
        undefined,
        undefined,
        mockTransaction
      );

      expect(createSpy).toHaveBeenCalledWith(
        {
          sitePolygonUuid: "primary-uuid",
          versionName: "Version_1",
          change: "Test change description",
          updatedById: 456,
          comment: null,
          type: "update",
          oldStatus: null,
          newStatus: null
        },
        { transaction: mockTransaction }
      );
    });

    it("should track status changes with old and new status", async () => {
      const createSpy = jest.spyOn(PolygonUpdates, "create").mockResolvedValue({} as any);

      await service.trackChange(
        "primary-uuid",
        "Version_1",
        "Status changed",
        789,
        "status",
        "draft",
        "approved",
        mockTransaction
      );

      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "status",
          oldStatus: "draft",
          newStatus: "approved"
        }),
        { transaction: mockTransaction }
      );
    });
  });

  describe("deactivateOtherVersions", () => {
    it("should deactivate all versions except specified one", async () => {
      const updateSpy = jest.spyOn(SitePolygon, "update").mockResolvedValue([3, []] as any);

      await service.deactivateOtherVersions("primary-uuid", "keep-active-uuid", mockTransaction);

      expect(updateSpy).toHaveBeenCalledWith(
        { isActive: false },
        {
          where: {
            primaryUuid: "primary-uuid",
            uuid: { $ne: "keep-active-uuid" }
          },
          transaction: mockTransaction
        }
      );
    });
  });

  describe("getVersionHistory", () => {
    it("should return all versions ordered by creation date", async () => {
      const mockVersions = [
        { uuid: "v3", createdAt: new Date("2025-11-10"), primaryUuid: "primary" },
        { uuid: "v2", createdAt: new Date("2025-11-09"), primaryUuid: "primary" },
        { uuid: "v1", createdAt: new Date("2025-11-08"), primaryUuid: "primary" }
      ] as any[];

      jest.spyOn(SitePolygon, "findAll").mockResolvedValue(mockVersions);

      const result = await service.getVersionHistory("primary-uuid");

      expect(result).toHaveLength(3);
      expect(SitePolygon.findAll).toHaveBeenCalledWith({
        where: { primaryUuid: "primary-uuid" },
        order: [["createdAt", "DESC"]],
        include: [{ model: PolygonGeometry, attributes: ["uuid"] }]
      });
    });
  });

  describe("activateVersion", () => {
    it("should throw NotFoundException when version does not exist", async () => {
      jest.spyOn(SitePolygon, "findOne").mockResolvedValue(null);

      await expect(service.activateVersion("non-existent-uuid", 1, mockTransaction)).rejects.toThrow(NotFoundException);
    });

    it("should activate specified version and deactivate others", async () => {
      const targetVersion = {
        uuid: "target-uuid",
        primaryUuid: "primary-uuid",
        versionName: "Version_1",
        isActive: false,
        save: jest.fn().mockResolvedValue(undefined)
      } as any;

      jest.spyOn(SitePolygon, "findOne").mockResolvedValue(targetVersion);
      jest.spyOn(SitePolygon, "update").mockResolvedValue([2, []] as any);
      jest.spyOn(PolygonUpdates, "create").mockResolvedValue({} as any);

      const result = await service.activateVersion("target-uuid", 999, mockTransaction);

      expect(result.isActive).toBe(true);
      expect(targetVersion.save).toHaveBeenCalledWith({ transaction: mockTransaction });
      expect(SitePolygon.update).toHaveBeenCalled();
    });
  });

  describe("getChangeHistory", () => {
    it("should return change history ordered by date", async () => {
      const mockChanges = [
        { id: 3, change: "Latest change", createdAt: new Date("2025-11-10") },
        { id: 2, change: "Middle change", createdAt: new Date("2025-11-09") },
        { id: 1, change: "First change", createdAt: new Date("2025-11-08") }
      ] as any[];

      jest.spyOn(PolygonUpdates, "findAll").mockResolvedValue(mockChanges);

      const result = await service.getChangeHistory("primary-uuid");

      expect(result).toHaveLength(3);
      expect(PolygonUpdates.findAll).toHaveBeenCalledWith({
        where: { sitePolygonUuid: "primary-uuid" },
        order: [["createdAt", "DESC"]]
      });
    });
  });

  describe("validateVersioningEligibility", () => {
    it("should throw NotFoundException when polygon does not exist", async () => {
      jest.spyOn(SitePolygon, "findOne").mockResolvedValue(null);

      await expect(service.validateVersioningEligibility("non-existent-uuid")).rejects.toThrow(NotFoundException);
    });

    it("should throw BadRequestException when primaryUuid is null", async () => {
      const polygon = { uuid: "test-uuid", primaryUuid: null } as any;
      jest.spyOn(SitePolygon, "findOne").mockResolvedValue(polygon);

      await expect(service.validateVersioningEligibility("test-uuid")).rejects.toThrow(BadRequestException);
    });

    it("should return polygon when valid", async () => {
      const polygon = { uuid: "test-uuid", primaryUuid: "primary-uuid" } as any;
      jest.spyOn(SitePolygon, "findOne").mockResolvedValue(polygon);

      const result = await service.validateVersioningEligibility("test-uuid");

      expect(result).toBe(polygon);
    });
  });
});

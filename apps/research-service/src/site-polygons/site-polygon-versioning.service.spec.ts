import { Test, TestingModule } from "@nestjs/testing";
import { SitePolygonVersioningService } from "./site-polygon-versioning.service";
import {
  SitePolygon,
  PolygonUpdates,
  PolygonGeometry,
  SitePolygonAttributeValue
} from "@terramatch-microservices/database/entities";
import { NotFoundException, BadRequestException } from "@nestjs/common";
import { Transaction, Op } from "sequelize";
import { EventService } from "@terramatch-microservices/common/events/event.service";
import { BoundingBoxService } from "../bounding-boxes/bounding-box.service";
import { GwcTileInvalidationService } from "@terramatch-microservices/common/gwc/gwc-tile-invalidation.service";

const mockTransaction = {
  commit: jest.fn(),
  rollback: jest.fn(),
  afterCommit: jest.fn((callback: () => void) => callback()),
  LOCK: {}
} as unknown as Transaction;

const flushMicrotasks = () => new Promise(resolve => setImmediate(resolve));

describe("SitePolygonVersioningService", () => {
  let service: SitePolygonVersioningService;
  let eventService: { sendPolygonVersionChangedAnalytics: jest.Mock };
  let boundingBoxService: { getPolygonsBoundingBox: jest.Mock };
  let gwcTileInvalidationService: { truncate: jest.Mock };

  beforeEach(async () => {
    eventService = {
      sendPolygonVersionChangedAnalytics: jest.fn().mockResolvedValue(undefined)
    };
    boundingBoxService = {
      getPolygonsBoundingBox: jest.fn().mockResolvedValue({ bbox: [0, 0, 1, 1] })
    };
    gwcTileInvalidationService = {
      truncate: jest.fn().mockResolvedValue(undefined)
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SitePolygonVersioningService,
        {
          provide: EventService,
          useValue: eventService
        },
        {
          provide: BoundingBoxService,
          useValue: boundingBoxService
        },
        {
          provide: GwcTileInvalidationService,
          useValue: gwcTileInvalidationService
        }
      ]
    }).compile();

    service = module.get<SitePolygonVersioningService>(SitePolygonVersioningService);

    // Default: no custom attribute values to copy. Individual tests override this as needed.
    jest.spyOn(SitePolygonAttributeValue, "findAll").mockResolvedValue([]);
    jest.spyOn(SitePolygonAttributeValue, "bulkCreate").mockResolvedValue([]);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("generateVersionName", () => {
    it("should generate version name with polygon name and user", () => {
      const result = service.generateVersionName("Test_Polygon", "John Doe");

      expect(result).toContain("Test_Polygon");
      expect(result).toContain("John_Doe");
      expect(result).toMatch(/_\d+_[A-Za-z]+_\d{4}_\d{2}_\d{2}_\d{2}/);
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
      const oldValues = { polyName: "Old Name" } as Partial<SitePolygon>;
      const newValues = { polyName: "New Name" } as Partial<SitePolygon>;

      const result = service.buildChangeDescription(oldValues, newValues);

      expect(result).toBe("polyName => from Old Name to New Name");
    });

    it("should build description for multiple field changes", () => {
      const oldValues = { polyName: "Old", numTrees: 100 } as Partial<SitePolygon>;
      const newValues = { polyName: "New", numTrees: 150 } as Partial<SitePolygon>;

      const result = service.buildChangeDescription(oldValues, newValues);

      expect(result).toContain("polyName => from Old to New");
      expect(result).toContain("numTrees => from 100 to 150");
    });

    it("should handle null values", () => {
      const oldValues = { numTrees: null } as Partial<SitePolygon>;
      const newValues = { numTrees: 50 } as Partial<SitePolygon>;

      const result = service.buildChangeDescription(oldValues, newValues);

      expect(result).toBe("numTrees => from null to 50");
    });

    it("should return default message when no changes", () => {
      const oldValues = { polyName: "Same" } as Partial<SitePolygon>;
      const newValues = { polyName: "Same" } as Partial<SitePolygon>;

      const result = service.buildChangeDescription(oldValues, newValues);

      expect(result).toBe("No attribute changes");
    });
  });

  describe("createVersion", () => {
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
      } as unknown as SitePolygon;

      jest.spyOn(SitePolygon, "bulkCreate").mockResolvedValue([{ uuid: "new-version-uuid" } as SitePolygon]);
      jest.spyOn(SitePolygon, "update").mockResolvedValue([1] as [affectedCount: number]);
      jest.spyOn(PolygonUpdates, "bulkCreate").mockResolvedValue([]);

      const result = await service.createVersion(
        basePolygon,
        { polyName: "Updated Name" },
        "new-geometry-uuid",
        1,
        "Updated polygon name",
        "Admin User",
        mockTransaction
      );

      expect(result.uuid).toBe("new-version-uuid");
      expect(SitePolygon.bulkCreate).toHaveBeenCalledWith(
        [
          expect.objectContaining({
            primaryUuid: basePrimaryUuid,
            polyName: "Updated Name",
            polygonUuid: "new-geometry-uuid",
            isActive: true
          })
        ],
        { transaction: mockTransaction }
      );
    });

    it("should deactivate other versions when creating new version", async () => {
      const basePrimaryUuid = "base-primary-uuid";
      const basePolygon = {
        uuid: "base-uuid",
        primaryUuid: basePrimaryUuid,
        get: jest.fn().mockReturnValue({ uuid: "base-uuid", primaryUuid: basePrimaryUuid })
      } as unknown as SitePolygon;

      jest.spyOn(SitePolygon, "bulkCreate").mockResolvedValue([{ uuid: "new-uuid" } as SitePolygon]);
      const updateSpy = jest.spyOn(SitePolygon, "update").mockResolvedValue([2] as [affectedCount: number]);
      jest.spyOn(PolygonUpdates, "bulkCreate").mockResolvedValue([]);

      await service.createVersion(basePolygon, {}, null, 1, "Test", null, mockTransaction);

      expect(updateSpy).toHaveBeenCalledWith(
        { isActive: false },
        expect.objectContaining({
          where: expect.objectContaining({
            primaryUuid: { [Op.in]: [basePrimaryUuid] }
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
      } as unknown as SitePolygon;

      jest.spyOn(SitePolygon, "bulkCreate").mockResolvedValue([{ uuid: "new-uuid" } as SitePolygon]);
      jest.spyOn(SitePolygon, "update").mockResolvedValue([1] as [affectedCount: number]);
      const trackChangeSpy = jest.spyOn(PolygonUpdates, "bulkCreate").mockResolvedValue([]);

      await service.createVersion(basePolygon, {}, null, 123, "Geometry updated", "Test User", mockTransaction);

      expect(trackChangeSpy).toHaveBeenCalledWith(
        [
          expect.objectContaining({
            sitePolygonUuid: "primary-uuid",
            change: "Geometry updated",
            updatedById: 123,
            type: "update"
          })
        ],
        { transaction: mockTransaction }
      );
    });
  });

  describe("createVersions", () => {
    it("should bulk create versions and keep only the last new version active per group", async () => {
      const sharedPrimaryUuid = "shared-primary-uuid";
      const basePolygonOne = {
        uuid: "base-uuid-1",
        primaryUuid: sharedPrimaryUuid,
        polyName: "Polygon 1",
        get: jest.fn().mockReturnValue({
          uuid: "base-uuid-1",
          primaryUuid: sharedPrimaryUuid,
          polyName: "Polygon 1"
        })
      } as unknown as SitePolygon;
      const basePolygonTwo = {
        uuid: "base-uuid-2",
        primaryUuid: sharedPrimaryUuid,
        polyName: "Polygon 2",
        get: jest.fn().mockReturnValue({
          uuid: "base-uuid-2",
          primaryUuid: sharedPrimaryUuid,
          polyName: "Polygon 2"
        })
      } as unknown as SitePolygon;

      const bulkCreateSpy = jest
        .spyOn(SitePolygon, "bulkCreate")
        .mockImplementation(async records => records as unknown as SitePolygon[]);
      const updateSpy = jest.spyOn(SitePolygon, "update").mockResolvedValue([2] as [affectedCount: number]);
      jest.spyOn(PolygonUpdates, "bulkCreate").mockResolvedValue([]);

      const result = await service.createVersions(
        [
          {
            basePolygon: basePolygonOne,
            attributeChanges: { numTrees: 10, status: "draft" },
            newPolygonGeometryUuid: null,
            userId: 1,
            changeReason: "First update",
            userFullName: "User One"
          },
          {
            basePolygon: basePolygonTwo,
            attributeChanges: { numTrees: 20, status: "draft" },
            newPolygonGeometryUuid: null,
            userId: 1,
            changeReason: "Second update",
            userFullName: "User One"
          }
        ],
        mockTransaction
      );

      expect(result).toHaveLength(2);
      expect(bulkCreateSpy).toHaveBeenCalledTimes(1);
      expect(updateSpy).toHaveBeenCalledWith(
        { isActive: false },
        expect.objectContaining({
          where: expect.objectContaining({
            primaryUuid: { [Op.in]: [sharedPrimaryUuid] },
            uuid: { [Op.notIn]: [result[1].uuid] }
          }),
          transaction: mockTransaction
        })
      );
    });

    it("should queue polygon_version_changed analytics after commit", async () => {
      const basePrimaryUuid = "primary-group-uuid";
      const basePolygon = {
        uuid: "previous-version-uuid",
        primaryUuid: basePrimaryUuid,
        siteUuid: "site-uuid",
        polyName: "Polygon 1",
        get: jest.fn().mockReturnValue({
          uuid: "previous-version-uuid",
          primaryUuid: basePrimaryUuid,
          siteUuid: "site-uuid",
          polyName: "Polygon 1"
        })
      } as unknown as SitePolygon;

      jest.spyOn(SitePolygon, "bulkCreate").mockResolvedValue([{ uuid: "new-version-uuid" } as SitePolygon]);
      jest.spyOn(SitePolygon, "update").mockResolvedValue([1] as [affectedCount: number]);
      jest.spyOn(PolygonUpdates, "bulkCreate").mockResolvedValue([]);

      await service.createVersions(
        [
          {
            basePolygon,
            attributeChanges: { numTrees: 10, status: "draft" },
            newPolygonGeometryUuid: null,
            userId: 1,
            changeReason: "Updated attributes",
            userFullName: "User One",
            source: "terramatch",
            isAdminSession: false
          }
        ],
        mockTransaction
      );

      expect(eventService.sendPolygonVersionChangedAnalytics).toHaveBeenCalledWith("primary-group-uuid", {
        polygon_id: "primary-group-uuid",
        entity_id: "site-uuid",
        entity_type: "site",
        previous_version: "previous-version-uuid",
        new_version: "new-version-uuid",
        change_source: "attribute_edit"
      });
    });

    it("should truncate GWC for the union of old and new polygon envelopes after commit", async () => {
      const basePolygon = {
        uuid: "base-uuid",
        primaryUuid: "primary-uuid",
        polygonUuid: "old-polygon-uuid",
        get: jest.fn().mockReturnValue({ uuid: "base-uuid", primaryUuid: "primary-uuid" })
      } as unknown as SitePolygon;

      jest
        .spyOn(SitePolygon, "bulkCreate")
        .mockResolvedValue([{ uuid: "new-version-uuid", polygonUuid: "new-polygon-uuid" } as SitePolygon]);
      jest.spyOn(SitePolygon, "update").mockResolvedValue([1] as [affectedCount: number]);
      jest.spyOn(PolygonUpdates, "bulkCreate").mockResolvedValue([]);

      await service.createVersions(
        [
          {
            basePolygon,
            attributeChanges: {},
            newPolygonGeometryUuid: "new-polygon-uuid",
            userId: 1,
            changeReason: "Moved polygon",
            userFullName: "User One"
          }
        ],
        mockTransaction
      );
      await flushMicrotasks();

      expect(boundingBoxService.getPolygonsBoundingBox).toHaveBeenCalledWith(["old-polygon-uuid", "new-polygon-uuid"]);
      expect(gwcTileInvalidationService.truncate).toHaveBeenCalledWith([0, 0, 1, 1], ["active"]);
    });

    it("should not attempt GWC invalidation when no polygon uuids are involved", async () => {
      const basePolygon = {
        uuid: "base-uuid",
        primaryUuid: "primary-uuid",
        polygonUuid: null,
        get: jest.fn().mockReturnValue({ uuid: "base-uuid", primaryUuid: "primary-uuid" })
      } as unknown as SitePolygon;

      jest.spyOn(SitePolygon, "bulkCreate").mockResolvedValue([{ uuid: "new-version-uuid" } as SitePolygon]);
      jest.spyOn(SitePolygon, "update").mockResolvedValue([1] as [affectedCount: number]);
      jest.spyOn(PolygonUpdates, "bulkCreate").mockResolvedValue([]);

      await service.createVersions(
        [
          {
            basePolygon,
            attributeChanges: {},
            newPolygonGeometryUuid: null,
            userId: 1,
            changeReason: "Attribute only",
            userFullName: "User One"
          }
        ],
        mockTransaction
      );
      await flushMicrotasks();

      expect(boundingBoxService.getPolygonsBoundingBox).not.toHaveBeenCalled();
      expect(gwcTileInvalidationService.truncate).not.toHaveBeenCalled();
    });

    it("should log and swallow errors instead of throwing when GWC invalidation fails", async () => {
      const basePolygon = {
        uuid: "base-uuid",
        primaryUuid: "primary-uuid",
        polygonUuid: "old-polygon-uuid",
        get: jest.fn().mockReturnValue({ uuid: "base-uuid", primaryUuid: "primary-uuid" })
      } as unknown as SitePolygon;

      jest.spyOn(SitePolygon, "bulkCreate").mockResolvedValue([{ uuid: "new-version-uuid" } as SitePolygon]);
      jest.spyOn(SitePolygon, "update").mockResolvedValue([1] as [affectedCount: number]);
      jest.spyOn(PolygonUpdates, "bulkCreate").mockResolvedValue([]);
      boundingBoxService.getPolygonsBoundingBox.mockRejectedValueOnce(new Error("boom"));

      await expect(
        service.createVersions(
          [
            {
              basePolygon,
              attributeChanges: {},
              newPolygonGeometryUuid: null,
              userId: 1,
              changeReason: "Attribute only",
              userFullName: "User One"
            }
          ],
          mockTransaction
        )
      ).resolves.toBeDefined();
      await flushMicrotasks();

      expect(gwcTileInvalidationService.truncate).not.toHaveBeenCalled();
    });

    describe("custom attribute value copying", () => {
      it("should copy existing custom attribute values from the base polygon to the new version", async () => {
        const basePolygon = {
          uuid: "base-uuid",
          primaryUuid: "primary-uuid",
          get: jest.fn().mockReturnValue({ uuid: "base-uuid", primaryUuid: "primary-uuid" })
        } as unknown as SitePolygon;

        jest.spyOn(SitePolygon, "bulkCreate").mockResolvedValue([{ uuid: "new-version-uuid" } as SitePolygon]);
        jest.spyOn(SitePolygon, "update").mockResolvedValue([1] as [affectedCount: number]);
        jest.spyOn(PolygonUpdates, "bulkCreate").mockResolvedValue([]);

        const findAllSpy = jest.spyOn(SitePolygonAttributeValue, "findAll").mockResolvedValue([
          {
            sitePolygonUuid: "base-uuid",
            polygonAttributeDefinitionId: 1,
            value: "farmer-managed"
          },
          {
            sitePolygonUuid: "base-uuid",
            polygonAttributeDefinitionId: 2,
            value: ["strata-a", "strata-b"]
          }
        ] as SitePolygonAttributeValue[]);
        const bulkCreateSpy = jest.spyOn(SitePolygonAttributeValue, "bulkCreate").mockResolvedValue([]);

        await service.createVersions(
          [
            {
              basePolygon,
              attributeChanges: {},
              newPolygonGeometryUuid: null,
              userId: 1,
              changeReason: "Attribute only",
              userFullName: "User One"
            }
          ],
          mockTransaction
        );

        expect(findAllSpy).toHaveBeenCalledWith({
          where: { sitePolygonUuid: { [Op.in]: ["base-uuid"] } },
          transaction: mockTransaction
        });
        expect(bulkCreateSpy).toHaveBeenCalledWith(
          [
            { sitePolygonUuid: "new-version-uuid", polygonAttributeDefinitionId: 1, value: "farmer-managed" },
            { sitePolygonUuid: "new-version-uuid", polygonAttributeDefinitionId: 2, value: ["strata-a", "strata-b"] }
          ],
          { transaction: mockTransaction }
        );
      });

      it("should copy values for each polygon independently when creating multiple versions", async () => {
        const basePolygonOne = {
          uuid: "base-uuid-1",
          primaryUuid: "primary-uuid-1",
          get: jest.fn().mockReturnValue({ uuid: "base-uuid-1", primaryUuid: "primary-uuid-1" })
        } as unknown as SitePolygon;
        const basePolygonTwo = {
          uuid: "base-uuid-2",
          primaryUuid: "primary-uuid-2",
          get: jest.fn().mockReturnValue({ uuid: "base-uuid-2", primaryUuid: "primary-uuid-2" })
        } as unknown as SitePolygon;

        jest
          .spyOn(SitePolygon, "bulkCreate")
          .mockResolvedValue([
            { uuid: "new-version-uuid-1" } as SitePolygon,
            { uuid: "new-version-uuid-2" } as SitePolygon
          ]);
        jest.spyOn(SitePolygon, "update").mockResolvedValue([2] as [affectedCount: number]);
        jest.spyOn(PolygonUpdates, "bulkCreate").mockResolvedValue([]);

        jest.spyOn(SitePolygonAttributeValue, "findAll").mockResolvedValue([
          { sitePolygonUuid: "base-uuid-1", polygonAttributeDefinitionId: 1, value: "value-1" },
          { sitePolygonUuid: "base-uuid-2", polygonAttributeDefinitionId: 1, value: "value-2" }
        ] as SitePolygonAttributeValue[]);
        const bulkCreateSpy = jest.spyOn(SitePolygonAttributeValue, "bulkCreate").mockResolvedValue([]);

        await service.createVersions(
          [
            {
              basePolygon: basePolygonOne,
              attributeChanges: {},
              newPolygonGeometryUuid: null,
              userId: 1,
              changeReason: "Update 1",
              userFullName: "User One"
            },
            {
              basePolygon: basePolygonTwo,
              attributeChanges: {},
              newPolygonGeometryUuid: null,
              userId: 1,
              changeReason: "Update 2",
              userFullName: "User One"
            }
          ],
          mockTransaction
        );

        expect(bulkCreateSpy).toHaveBeenCalledWith(
          [
            { sitePolygonUuid: "new-version-uuid-1", polygonAttributeDefinitionId: 1, value: "value-1" },
            { sitePolygonUuid: "new-version-uuid-2", polygonAttributeDefinitionId: 1, value: "value-2" }
          ],
          { transaction: mockTransaction }
        );
      });

      it("should preserve null values when copying", async () => {
        const basePolygon = {
          uuid: "base-uuid",
          primaryUuid: "primary-uuid",
          get: jest.fn().mockReturnValue({ uuid: "base-uuid", primaryUuid: "primary-uuid" })
        } as unknown as SitePolygon;

        jest.spyOn(SitePolygon, "bulkCreate").mockResolvedValue([{ uuid: "new-version-uuid" } as SitePolygon]);
        jest.spyOn(SitePolygon, "update").mockResolvedValue([1] as [affectedCount: number]);
        jest.spyOn(PolygonUpdates, "bulkCreate").mockResolvedValue([]);

        jest
          .spyOn(SitePolygonAttributeValue, "findAll")
          .mockResolvedValue([
            { sitePolygonUuid: "base-uuid", polygonAttributeDefinitionId: 1, value: null }
          ] as SitePolygonAttributeValue[]);
        const bulkCreateSpy = jest.spyOn(SitePolygonAttributeValue, "bulkCreate").mockResolvedValue([]);

        await service.createVersions(
          [
            {
              basePolygon,
              attributeChanges: {},
              newPolygonGeometryUuid: null,
              userId: 1,
              changeReason: "Attribute only",
              userFullName: "User One"
            }
          ],
          mockTransaction
        );

        expect(bulkCreateSpy).toHaveBeenCalledWith(
          [{ sitePolygonUuid: "new-version-uuid", polygonAttributeDefinitionId: 1, value: null }],
          { transaction: mockTransaction }
        );
      });

      it("should not call bulkCreate when the base polygon has no custom attribute values", async () => {
        const basePolygon = {
          uuid: "base-uuid",
          primaryUuid: "primary-uuid",
          get: jest.fn().mockReturnValue({ uuid: "base-uuid", primaryUuid: "primary-uuid" })
        } as unknown as SitePolygon;

        jest.spyOn(SitePolygon, "bulkCreate").mockResolvedValue([{ uuid: "new-version-uuid" } as SitePolygon]);
        jest.spyOn(SitePolygon, "update").mockResolvedValue([1] as [affectedCount: number]);
        jest.spyOn(PolygonUpdates, "bulkCreate").mockResolvedValue([]);

        jest.spyOn(SitePolygonAttributeValue, "findAll").mockResolvedValue([]);
        const bulkCreateSpy = jest.spyOn(SitePolygonAttributeValue, "bulkCreate").mockResolvedValue([]);

        await service.createVersions(
          [
            {
              basePolygon,
              attributeChanges: {},
              newPolygonGeometryUuid: null,
              userId: 1,
              changeReason: "Attribute only",
              userFullName: "User One"
            }
          ],
          mockTransaction
        );

        expect(bulkCreateSpy).not.toHaveBeenCalled();
      });

      it("should copy values before deactivating other versions, within the same transaction", async () => {
        const basePolygon = {
          uuid: "base-uuid",
          primaryUuid: "primary-uuid",
          get: jest.fn().mockReturnValue({ uuid: "base-uuid", primaryUuid: "primary-uuid" })
        } as unknown as SitePolygon;

        jest.spyOn(SitePolygon, "bulkCreate").mockResolvedValue([{ uuid: "new-version-uuid" } as SitePolygon]);
        const updateSpy = jest.spyOn(SitePolygon, "update").mockResolvedValue([1] as [affectedCount: number]);
        jest.spyOn(PolygonUpdates, "bulkCreate").mockResolvedValue([]);

        jest
          .spyOn(SitePolygonAttributeValue, "findAll")
          .mockResolvedValue([
            { sitePolygonUuid: "base-uuid", polygonAttributeDefinitionId: 1, value: "value" }
          ] as SitePolygonAttributeValue[]);
        const bulkCreateSpy = jest.spyOn(SitePolygonAttributeValue, "bulkCreate").mockResolvedValue([]);

        const callOrder: string[] = [];
        bulkCreateSpy.mockImplementation(async () => {
          callOrder.push("copyAttributeValues");
          return [];
        });
        updateSpy.mockImplementation(async () => {
          callOrder.push("deactivateOtherVersions");
          return [1];
        });

        await service.createVersions(
          [
            {
              basePolygon,
              attributeChanges: {},
              newPolygonGeometryUuid: null,
              userId: 1,
              changeReason: "Attribute only",
              userFullName: "User One"
            }
          ],
          mockTransaction
        );

        expect(callOrder).toEqual(["copyAttributeValues", "deactivateOtherVersions"]);
        expect(bulkCreateSpy).toHaveBeenCalledWith(expect.anything(), { transaction: mockTransaction });
      });
    });
  });

  describe("trackChange", () => {
    it("should create polygon update record with correct data", async () => {
      const createSpy = jest.spyOn(PolygonUpdates, "create").mockResolvedValue({} as PolygonUpdates);

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
      const createSpy = jest.spyOn(PolygonUpdates, "create").mockResolvedValue({} as PolygonUpdates);

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
      const updateSpy = jest.spyOn(SitePolygon, "update").mockResolvedValue([3] as [affectedCount: number]);

      await service.deactivateOtherVersions("primary-uuid", "keep-active-uuid", mockTransaction);

      expect(updateSpy).toHaveBeenCalledWith(
        { isActive: false },
        {
          where: {
            primaryUuid: "primary-uuid",
            uuid: { [Op.ne]: "keep-active-uuid" }
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
      ] as SitePolygon[];

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
      } as unknown as SitePolygon;

      jest.spyOn(SitePolygon, "findOne").mockResolvedValue(targetVersion);
      jest.spyOn(SitePolygon, "update").mockResolvedValue([2] as [affectedCount: number]);
      jest.spyOn(PolygonUpdates, "create").mockResolvedValue({} as PolygonUpdates);

      const result = await service.activateVersion("target-uuid", 999, mockTransaction);

      expect(result.isActive).toBe(true);
      expect(targetVersion.save).toHaveBeenCalledWith({ transaction: mockTransaction });
      expect(SitePolygon.update).toHaveBeenCalled();
    });

    it("should truncate GWC for the union of the previously and newly active envelopes", async () => {
      const targetVersion = {
        uuid: "target-uuid",
        primaryUuid: "primary-uuid",
        polygonUuid: "target-polygon-uuid",
        versionName: "Version_1",
        isActive: false,
        save: jest.fn().mockResolvedValue(undefined)
      } as unknown as SitePolygon;
      const previouslyActiveVersion = {
        uuid: "previous-uuid",
        primaryUuid: "primary-uuid",
        polygonUuid: "previous-polygon-uuid",
        isActive: true
      } as unknown as SitePolygon;

      jest
        .spyOn(SitePolygon, "findOne")
        .mockResolvedValueOnce(targetVersion)
        .mockResolvedValueOnce(previouslyActiveVersion);
      jest.spyOn(SitePolygon, "update").mockResolvedValue([1] as [affectedCount: number]);
      jest.spyOn(PolygonUpdates, "create").mockResolvedValue({} as PolygonUpdates);

      await service.activateVersion("target-uuid", 999, mockTransaction);
      await flushMicrotasks();

      expect(boundingBoxService.getPolygonsBoundingBox).toHaveBeenCalledWith([
        "previous-polygon-uuid",
        "target-polygon-uuid"
      ]);
      expect(gwcTileInvalidationService.truncate).toHaveBeenCalledWith([0, 0, 1, 1], ["active"]);
    });
  });

  describe("getChangeHistory", () => {
    it("should return change history ordered by date", async () => {
      const mockChanges = [
        { id: 3, change: "Latest change", createdAt: new Date("2025-11-10") },
        { id: 2, change: "Middle change", createdAt: new Date("2025-11-09") },
        { id: 1, change: "First change", createdAt: new Date("2025-11-08") }
      ] as PolygonUpdates[];

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
      jest.spyOn(SitePolygon, "findAll").mockResolvedValueOnce([]);

      await expect(service.validateVersioningEligibility("non-existent-uuid")).rejects.toThrow(NotFoundException);
    });

    it("should throw BadRequestException when primaryUuid is null", async () => {
      const polygon = { uuid: "test-uuid", primaryUuid: null } as unknown as SitePolygon;
      jest.spyOn(SitePolygon, "findAll").mockResolvedValueOnce([polygon]);

      await expect(service.validateVersioningEligibility("test-uuid")).rejects.toThrow(BadRequestException);
    });

    it("should return polygon when valid", async () => {
      const polygon = { uuid: "test-uuid", primaryUuid: "primary-uuid" } as unknown as SitePolygon;
      const activePolygon = {
        uuid: "active-uuid",
        primaryUuid: "primary-uuid",
        isActive: true
      } as unknown as SitePolygon;
      jest.spyOn(SitePolygon, "findAll").mockResolvedValueOnce([polygon]).mockResolvedValueOnce([activePolygon]);

      const result = await service.validateVersioningEligibility("test-uuid");

      expect(result).toBe(activePolygon);
      expect(SitePolygon.findAll).toHaveBeenCalledTimes(2);
    });

    it("should throw NotFoundException when no active version found", async () => {
      const polygon = { uuid: "test-uuid", primaryUuid: "primary-uuid" } as unknown as SitePolygon;
      jest.spyOn(SitePolygon, "findAll").mockResolvedValueOnce([polygon]).mockResolvedValueOnce([]);

      await expect(service.validateVersioningEligibility("test-uuid")).rejects.toThrow(NotFoundException);
      expect(SitePolygon.findAll).toHaveBeenCalledTimes(2);
    });
  });

  describe("validateBulkVersioningEligibility", () => {
    it("should resolve active polygons for each requested uuid", async () => {
      const polygonOne = { uuid: "request-uuid-1", primaryUuid: "primary-uuid-1" } as SitePolygon;
      const polygonTwo = { uuid: "request-uuid-2", primaryUuid: "primary-uuid-2" } as SitePolygon;
      const activePolygonOne = { uuid: "active-uuid-1", primaryUuid: "primary-uuid-1", isActive: true } as SitePolygon;
      const activePolygonTwo = { uuid: "active-uuid-2", primaryUuid: "primary-uuid-2", isActive: true } as SitePolygon;

      jest
        .spyOn(SitePolygon, "findAll")
        .mockResolvedValueOnce([polygonOne, polygonTwo])
        .mockResolvedValueOnce([activePolygonOne, activePolygonTwo]);

      const result = await service.validateBulkVersioningEligibility(
        ["request-uuid-1", "request-uuid-2"],
        mockTransaction
      );

      expect(result.get("request-uuid-1")).toBe(activePolygonOne);
      expect(result.get("request-uuid-2")).toBe(activePolygonTwo);
    });
  });
});

import { Test, TestingModule } from "@nestjs/testing";
import { createMock, DeepMocked } from "@golevelup/ts-jest";
import { BadRequestException, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { PolygonClippingController } from "./polygon-clipping.controller";
import { PolygonClippingService } from "./polygon-clipping.service";
import { PolicyService } from "@terramatch-microservices/common";
import { SitePolygon, DelayedJob, Site, User } from "@terramatch-microservices/database/entities";
import { PolygonListClippingRequestBody } from "./dto/clip-polygon-request.dto";
import { getQueueToken } from "@nestjs/bullmq";
import { Queue, Job } from "bullmq";

describe("PolygonClippingController", () => {
  let controller: PolygonClippingController;
  let clippingService: DeepMocked<PolygonClippingService>;
  let policyService: DeepMocked<PolicyService>;
  let mockQueue: DeepMocked<Queue>;

  beforeEach(async () => {
    jest.spyOn(DelayedJob, "create").mockResolvedValue({
      id: 1,
      uuid: "job-uuid-123",
      name: "Polygon Clipping",
      totalContent: 0,
      processedContent: 0,
      progressMessage: "Starting clipping...",
      metadata: {},
      isAcknowledged: false,
      createdBy: 1
    } as unknown as DelayedJob);

    jest.spyOn(Site, "findOne").mockResolvedValue({
      id: 1,
      uuid: "site-uuid",
      name: "Test Site",
      projectId: 1
    } as unknown as Site);

    jest.spyOn(User, "findByPk").mockResolvedValue({
      id: 1,
      fullName: "Test User",
      getSourceFromRoles: jest.fn().mockReturnValue("terramatch")
    } as unknown as User);

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PolygonClippingController],
      providers: [
        { provide: PolygonClippingService, useValue: (clippingService = createMock<PolygonClippingService>()) },
        { provide: PolicyService, useValue: (policyService = createMock<PolicyService>()) },
        {
          provide: getQueueToken("clipping"),
          useValue: (mockQueue = createMock<Queue>())
        }
      ]
    }).compile();

    controller = module.get<PolygonClippingController>(PolygonClippingController);
    Object.defineProperty(policyService, "userId", {
      value: 1,
      writable: true,
      configurable: true
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("createSiteClippedVersions", () => {
    const siteUuid = "550e8400-e29b-41d4-a716-446655440000";

    it("should throw UnauthorizedException when user is not authorized", async () => {
      policyService.authorize.mockRejectedValue(new UnauthorizedException());

      await expect(controller.createSiteClippedVersions(siteUuid, { authenticatedUserId: 1 })).rejects.toThrow(
        UnauthorizedException
      );
      expect(policyService.authorize).toHaveBeenCalledWith("update", SitePolygon);
    });

    it("should throw NotFoundException when no fixable polygons are found", async () => {
      policyService.authorize.mockResolvedValue(undefined);
      clippingService.getFixablePolygonsForSite.mockResolvedValue([]);

      await expect(controller.createSiteClippedVersions(siteUuid, { authenticatedUserId: 1 })).rejects.toThrow(
        NotFoundException
      );
      expect(clippingService.getFixablePolygonsForSite).toHaveBeenCalledWith(siteUuid);
    });

    it("should successfully create site polygon clipping", async () => {
      const polygonUuids = ["polygon-uuid-1", "polygon-uuid-2"];

      policyService.authorize.mockResolvedValue(undefined);
      clippingService.getFixablePolygonsForSite.mockResolvedValue(polygonUuids);
      mockQueue.add.mockResolvedValue({ id: "job-1" } as Job);

      const result = await controller.createSiteClippedVersions(siteUuid, { authenticatedUserId: 1 });

      expect(policyService.authorize).toHaveBeenCalledWith("update", SitePolygon);
      expect(clippingService.getFixablePolygonsForSite).toHaveBeenCalledWith(siteUuid);
      expect(mockQueue.add).toHaveBeenCalledWith(
        "clipAndVersion",
        expect.objectContaining({
          polygonUuids,
          userId: 1
        })
      );
      expect(result).toBeDefined();
      expect(result.id).toBe("job-uuid-123");
    });

    it("should handle multiple polygons being clipped", async () => {
      const polygonUuids = ["polygon-uuid-1", "polygon-uuid-2", "polygon-uuid-3"];

      policyService.authorize.mockResolvedValue(undefined);
      clippingService.getFixablePolygonsForSite.mockResolvedValue(polygonUuids);
      mockQueue.add.mockResolvedValue({ id: "job-1" } as Job);

      const result = await controller.createSiteClippedVersions(siteUuid, { authenticatedUserId: 1 });

      expect(mockQueue.add).toHaveBeenCalledWith(
        "clipAndVersion",
        expect.objectContaining({
          polygonUuids
        })
      );
      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
    });
  });

  describe("createProjectClippedVersions", () => {
    const siteUuid = "550e8400-e29b-41d4-a716-446655440000";

    it("should throw UnauthorizedException when user is not authorized", async () => {
      policyService.authorize.mockRejectedValue(new UnauthorizedException());

      await expect(controller.createProjectClippedVersions(siteUuid, { authenticatedUserId: 1 })).rejects.toThrow(
        UnauthorizedException
      );
      expect(policyService.authorize).toHaveBeenCalledWith("update", SitePolygon);
      expect(clippingService.getFixablePolygonsForProjectBySite).not.toHaveBeenCalled();
    });

    it("should throw NotFoundException when no fixable polygons are found", async () => {
      policyService.authorize.mockResolvedValue(undefined);
      clippingService.getFixablePolygonsForProjectBySite.mockResolvedValue([]);

      await expect(controller.createProjectClippedVersions(siteUuid, { authenticatedUserId: 1 })).rejects.toThrow(
        NotFoundException
      );
      expect(clippingService.getFixablePolygonsForProjectBySite).toHaveBeenCalledWith(siteUuid);
    });

    it("should successfully create project polygon clipping", async () => {
      const polygonUuids = ["polygon-uuid-1", "polygon-uuid-2"];

      policyService.authorize.mockResolvedValue(undefined);
      clippingService.getFixablePolygonsForProjectBySite.mockResolvedValue(polygonUuids);
      mockQueue.add.mockResolvedValue({ id: "job-1" } as Job);

      const result = await controller.createProjectClippedVersions(siteUuid, { authenticatedUserId: 1 });

      expect(policyService.authorize).toHaveBeenCalledWith("update", SitePolygon);
      expect(clippingService.getFixablePolygonsForProjectBySite).toHaveBeenCalledWith(siteUuid);
      expect(mockQueue.add).toHaveBeenCalledWith(
        "clipAndVersion",
        expect.objectContaining({
          polygonUuids
        })
      );
      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
    });
  });

  describe("createPolygonListClippedVersions", () => {
    const polygonUuids = ["550e8400-e29b-41d4-a716-446655440000", "660e8400-e29b-41d4-a716-446655440001"];
    const payload: PolygonListClippingRequestBody = {
      data: {
        type: "polygon-clipping",
        attributes: {
          polygonUuids
        }
      }
    };

    it("should throw UnauthorizedException when user is not authorized", async () => {
      policyService.authorize.mockRejectedValue(new UnauthorizedException());

      await expect(controller.createPolygonListClippedVersions(payload, { authenticatedUserId: 1 })).rejects.toThrow(
        UnauthorizedException
      );
      expect(policyService.authorize).toHaveBeenCalledWith("update", SitePolygon);
      expect(clippingService.filterFixablePolygonsFromList).not.toHaveBeenCalled();
    });

    it("should throw BadRequestException when no polygon UUIDs are provided", async () => {
      const emptyPayload: PolygonListClippingRequestBody = {
        data: {
          type: "polygon-clipping",
          attributes: {
            polygonUuids: []
          }
        }
      };

      policyService.authorize.mockResolvedValue(undefined);

      await expect(
        controller.createPolygonListClippedVersions(emptyPayload, { authenticatedUserId: 1 })
      ).rejects.toThrow(BadRequestException);
      expect(clippingService.filterFixablePolygonsFromList).not.toHaveBeenCalled();
    });

    it("should throw NotFoundException when no fixable polygons are found", async () => {
      policyService.authorize.mockResolvedValue(undefined);
      clippingService.filterFixablePolygonsFromList.mockResolvedValue([]);

      await expect(controller.createPolygonListClippedVersions(payload, { authenticatedUserId: 1 })).rejects.toThrow(
        NotFoundException
      );
      expect(clippingService.filterFixablePolygonsFromList).toHaveBeenCalledWith(polygonUuids);
    });

    it("should return ClippedVersionDto for single polygon", async () => {
      const fixablePolygonUuids = ["polygon-uuid-1"];
      const createdVersions = [
        {
          uuid: "version-uuid-1",
          polyName: "Test Polygon 1",
          originalArea: 10.5,
          newArea: 10.2,
          areaRemoved: 0.3
        }
      ];

      policyService.authorize.mockResolvedValue(undefined);
      clippingService.filterFixablePolygonsFromList.mockResolvedValue(fixablePolygonUuids);
      clippingService.clipAndCreateVersions.mockResolvedValue(createdVersions);

      const result = await controller.createPolygonListClippedVersions(payload, { authenticatedUserId: 1 });

      expect(policyService.authorize).toHaveBeenCalledWith("update", SitePolygon);
      expect(clippingService.filterFixablePolygonsFromList).toHaveBeenCalledWith(polygonUuids);
      expect(clippingService.clipAndCreateVersions).toHaveBeenCalled();
      expect(result).toBeDefined();
      expect(result.id).toBe("version-uuid-1");
    });

    it("should return DelayedJobDto for multiple polygons", async () => {
      const requestedUuids = ["polygon-uuid-1", "polygon-uuid-2", "polygon-uuid-3"];
      const fixablePolygonUuids = ["polygon-uuid-1", "polygon-uuid-2"];
      const payloadMultiple: PolygonListClippingRequestBody = {
        data: {
          type: "polygon-clipping",
          attributes: {
            polygonUuids: requestedUuids
          }
        }
      };

      policyService.authorize.mockResolvedValue(undefined);
      clippingService.filterFixablePolygonsFromList.mockResolvedValue(fixablePolygonUuids);
      mockQueue.add.mockResolvedValue({ id: "job-1" } as Job);

      const result = await controller.createPolygonListClippedVersions(payloadMultiple, { authenticatedUserId: 1 });

      expect(clippingService.filterFixablePolygonsFromList).toHaveBeenCalledWith(requestedUuids);
      expect(mockQueue.add).toHaveBeenCalledWith(
        "clipAndVersion",
        expect.objectContaining({
          polygonUuids: fixablePolygonUuids
        })
      );
      expect(result).toBeDefined();
      expect(result.id).toBe("job-uuid-123");
    });
  });
});

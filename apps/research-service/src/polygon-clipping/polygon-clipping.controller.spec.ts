import { Test, TestingModule } from "@nestjs/testing";
import { createMock, DeepMocked } from "@golevelup/ts-jest";
import { BadRequestException, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { PolygonClippingController } from "./polygon-clipping.controller";
import { PolygonClippingService } from "./polygon-clipping.service";
import { PolicyService } from "@terramatch-microservices/common";
import { SitePolygon, DelayedJob, Site, User, Project } from "@terramatch-microservices/database/entities";
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

  describe("createClippedVersions", () => {
    const siteUuid = "550e8400-e29b-41d4-a716-446655440000";
    const projectUuid = "660e8400-e29b-41d4-a716-446655440001";

    beforeEach(() => {
      jest.spyOn(Project, "findOne").mockResolvedValue({
        id: 1,
        uuid: projectUuid,
        name: "Test Project"
      } as unknown as Project);
    });

    it("should throw UnauthorizedException when user is not authorized", async () => {
      policyService.authorize.mockRejectedValue(new UnauthorizedException());

      await expect(controller.createClippedVersions({ siteUuid }, { authenticatedUserId: 1 })).rejects.toThrow(
        UnauthorizedException
      );
      expect(policyService.authorize).toHaveBeenCalledWith("update", SitePolygon);
    });

    it("should throw UnauthorizedException when authenticatedUserId is null", async () => {
      policyService.authorize.mockResolvedValue(undefined);

      await expect(controller.createClippedVersions({ siteUuid }, { authenticatedUserId: null })).rejects.toThrow(
        UnauthorizedException
      );
    });

    it("should throw BadRequestException when neither siteUuid nor projectUuid is provided", async () => {
      policyService.authorize.mockResolvedValue(undefined);

      await expect(controller.createClippedVersions({}, { authenticatedUserId: 1 })).rejects.toThrow(
        BadRequestException
      );
    });

    it("should throw BadRequestException when both siteUuid and projectUuid are provided", async () => {
      policyService.authorize.mockResolvedValue(undefined);

      await expect(
        controller.createClippedVersions({ siteUuid, projectUuid }, { authenticatedUserId: 1 })
      ).rejects.toThrow(BadRequestException);
    });

    it("should throw NotFoundException when no fixable polygons are found for site", async () => {
      policyService.authorize.mockResolvedValue(undefined);
      clippingService.getFixablePolygonsForSite.mockResolvedValue({
        site: { id: 1, uuid: siteUuid, name: "Test Site" } as Site,
        polygonIds: []
      });

      await expect(controller.createClippedVersions({ siteUuid }, { authenticatedUserId: 1 })).rejects.toThrow(
        NotFoundException
      );
      expect(clippingService.getFixablePolygonsForSite).toHaveBeenCalledWith(siteUuid);
    });

    it("should throw NotFoundException when site is not found", async () => {
      policyService.authorize.mockResolvedValue(undefined);
      clippingService.getFixablePolygonsForSite.mockRejectedValue(new NotFoundException(`Site not found: ${siteUuid}`));

      await expect(controller.createClippedVersions({ siteUuid }, { authenticatedUserId: 1 })).rejects.toThrow(
        NotFoundException
      );
      expect(clippingService.getFixablePolygonsForSite).toHaveBeenCalledWith(siteUuid);
    });

    it("should successfully create site polygon clipping with siteUuid", async () => {
      const polygonUuids = ["polygon-uuid-1", "polygon-uuid-2"];

      policyService.authorize.mockResolvedValue(undefined);
      clippingService.getFixablePolygonsForSite.mockResolvedValue({
        site: { id: 1, uuid: siteUuid, name: "Test Site" } as Site,
        polygonIds: polygonUuids
      });
      mockQueue.add.mockResolvedValue({ id: "job-1" } as Job);

      const result = await controller.createClippedVersions({ siteUuid }, { authenticatedUserId: 1 });

      expect(policyService.authorize).toHaveBeenCalledWith("update", SitePolygon);
      expect(clippingService.getFixablePolygonsForSite).toHaveBeenCalledWith(siteUuid);
      expect(mockQueue.add).toHaveBeenCalledWith(
        "clipAndVersion",
        expect.objectContaining({
          polygonUuids,
          userId: 1,
          siteUuid
        })
      );
      expect(result).toBeDefined();
      expect(result.id).toBe("job-uuid-123");
    });

    it("should throw NotFoundException when no fixable polygons are found for project", async () => {
      policyService.authorize.mockResolvedValue(undefined);
      clippingService.getFixablePolygonsForProject.mockResolvedValue({
        project: { id: 1, uuid: projectUuid, name: "Test Project" } as Project,
        polygonIds: []
      });

      await expect(controller.createClippedVersions({ projectUuid }, { authenticatedUserId: 1 })).rejects.toThrow(
        NotFoundException
      );
      expect(clippingService.getFixablePolygonsForProject).toHaveBeenCalledWith(projectUuid);
    });

    it("should throw NotFoundException when project is not found", async () => {
      policyService.authorize.mockResolvedValue(undefined);
      clippingService.getFixablePolygonsForProject.mockRejectedValue(
        new NotFoundException(`Project not found: ${projectUuid}`)
      );

      await expect(controller.createClippedVersions({ projectUuid }, { authenticatedUserId: 1 })).rejects.toThrow(
        NotFoundException
      );
      expect(clippingService.getFixablePolygonsForProject).toHaveBeenCalledWith(projectUuid);
    });

    it("should successfully create project polygon clipping with projectUuid", async () => {
      const polygonUuids = ["polygon-uuid-1", "polygon-uuid-2"];

      policyService.authorize.mockResolvedValue(undefined);
      clippingService.getFixablePolygonsForProject.mockResolvedValue({
        project: { id: 1, uuid: projectUuid, name: "Test Project" } as Project,
        polygonIds: polygonUuids
      });
      mockQueue.add.mockResolvedValue({ id: "job-1" } as Job);

      const result = await controller.createClippedVersions({ projectUuid }, { authenticatedUserId: 1 });

      expect(policyService.authorize).toHaveBeenCalledWith("update", SitePolygon);
      expect(clippingService.getFixablePolygonsForProject).toHaveBeenCalledWith(projectUuid);
      expect(mockQueue.add).toHaveBeenCalledWith(
        "clipAndVersion",
        expect.objectContaining({
          polygonUuids,
          userId: 1,
          siteUuid: undefined
        })
      );
      expect(result).toBeDefined();
      expect(result.id).toBe("job-uuid-123");
    });

    it("should throw BadRequestException when siteUuid is empty string", async () => {
      policyService.authorize.mockResolvedValue(undefined);
      await expect(controller.createClippedVersions({ siteUuid: "" }, { authenticatedUserId: 1 })).rejects.toThrow(
        BadRequestException
      );
    });

    it("should throw BadRequestException when projectUuid is empty string", async () => {
      policyService.authorize.mockResolvedValue(undefined);
      await expect(controller.createClippedVersions({ projectUuid: "" }, { authenticatedUserId: 1 })).rejects.toThrow(
        BadRequestException
      );
    });

    it("should throw BadRequestException when siteUuid is null after isEmpty check", async () => {
      policyService.authorize.mockResolvedValue(undefined);
      jest.spyOn(Site, "findOne").mockResolvedValue(null);
      await expect(
        controller.createClippedVersions({ siteUuid: null as unknown as string }, { authenticatedUserId: 1 })
      ).rejects.toThrow(BadRequestException);
    });

    it("should throw BadRequestException when projectUuid is null after isEmpty check", async () => {
      policyService.authorize.mockResolvedValue(undefined);
      jest.spyOn(Project, "findOne").mockResolvedValue(null);
      await expect(
        controller.createClippedVersions({ projectUuid: null as unknown as string }, { authenticatedUserId: 1 })
      ).rejects.toThrow(BadRequestException);
    });

    it("should handle project with null name", async () => {
      const polygonUuids = ["polygon-uuid-1"];

      policyService.authorize.mockResolvedValue(undefined);
      clippingService.getFixablePolygonsForProject.mockResolvedValue({
        project: { id: 1, uuid: projectUuid, name: null } as Project,
        polygonIds: polygonUuids
      });
      mockQueue.add.mockResolvedValue({ id: "job-1" } as Job);

      const result = await controller.createClippedVersions({ projectUuid }, { authenticatedUserId: 1 });

      expect(result).toBeDefined();
      expect(mockQueue.add).toHaveBeenCalledWith(
        "clipAndVersion",
        expect.objectContaining({
          polygonUuids
        })
      );
    });

    it("should handle user with null fullName", async () => {
      const polygonUuids = ["polygon-uuid-1"];

      policyService.authorize.mockResolvedValue(undefined);
      clippingService.getFixablePolygonsForSite.mockResolvedValue({
        site: { id: 1, uuid: siteUuid, name: "Test Site" } as Site,
        polygonIds: polygonUuids
      });
      jest.spyOn(User, "findByPk").mockResolvedValue({
        id: 1,
        fullName: null,
        getSourceFromRoles: jest.fn().mockReturnValue("terramatch")
      } as unknown as User);
      mockQueue.add.mockResolvedValue({ id: "job-1" } as Job);

      const result = await controller.createClippedVersions({ siteUuid }, { authenticatedUserId: 1 });

      expect(result).toBeDefined();
      expect(mockQueue.add).toHaveBeenCalledWith(
        "clipAndVersion",
        expect.objectContaining({
          userFullName: null
        })
      );
    });

    it("should handle user with null getSourceFromRoles result", async () => {
      const polygonUuids = ["polygon-uuid-1"];

      policyService.authorize.mockResolvedValue(undefined);
      clippingService.getFixablePolygonsForSite.mockResolvedValue({
        site: { id: 1, uuid: siteUuid, name: "Test Site" } as Site,
        polygonIds: polygonUuids
      });
      jest.spyOn(User, "findByPk").mockResolvedValue({
        id: 1,
        fullName: "Test User",
        getSourceFromRoles: jest.fn().mockReturnValue(null)
      } as unknown as User);
      mockQueue.add.mockResolvedValue({ id: "job-1" } as Job);

      const result = await controller.createClippedVersions({ siteUuid }, { authenticatedUserId: 1 });

      expect(result).toBeDefined();
      expect(mockQueue.add).toHaveBeenCalledWith(
        "clipAndVersion",
        expect.objectContaining({
          source: "terramatch"
        })
      );
    });

    it("should handle user not found (null user)", async () => {
      const polygonUuids = ["polygon-uuid-1"];

      policyService.authorize.mockResolvedValue(undefined);
      clippingService.getFixablePolygonsForSite.mockResolvedValue({
        site: { id: 1, uuid: siteUuid, name: "Test Site" } as Site,
        polygonIds: polygonUuids
      });
      jest.spyOn(User, "findByPk").mockResolvedValue(null);
      mockQueue.add.mockResolvedValue({ id: "job-1" } as Job);

      const result = await controller.createClippedVersions({ siteUuid }, { authenticatedUserId: 1 });

      expect(result).toBeDefined();
      expect(mockQueue.add).toHaveBeenCalledWith(
        "clipAndVersion",
        expect.objectContaining({
          source: "terramatch",
          userFullName: null
        })
      );
    });

    it("should handle site with null name", async () => {
      const polygonUuids = ["polygon-uuid-1"];

      policyService.authorize.mockResolvedValue(undefined);
      clippingService.getFixablePolygonsForSite.mockResolvedValue({
        site: { id: 1, uuid: siteUuid, name: null } as unknown as Site,
        polygonIds: polygonUuids
      });
      mockQueue.add.mockResolvedValue({ id: "job-1" } as Job);

      const result = await controller.createClippedVersions({ siteUuid }, { authenticatedUserId: 1 });

      expect(result).toBeDefined();
      expect(mockQueue.add).toHaveBeenCalled();
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

    it("should throw UnauthorizedException when authenticatedUserId is null", async () => {
      policyService.authorize.mockResolvedValue(undefined);

      await expect(controller.createPolygonListClippedVersions(payload, { authenticatedUserId: null })).rejects.toThrow(
        UnauthorizedException
      );
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

    it("should throw NotFoundException when single polygon fails to clip", async () => {
      const fixablePolygonUuids = ["polygon-uuid-1"];

      policyService.authorize.mockResolvedValue(undefined);
      clippingService.filterFixablePolygonsFromList.mockResolvedValue(fixablePolygonUuids);
      clippingService.clipAndCreateVersions.mockResolvedValue([]);

      await expect(controller.createPolygonListClippedVersions(payload, { authenticatedUserId: 1 })).rejects.toThrow(
        NotFoundException
      );
      expect(clippingService.clipAndCreateVersions).toHaveBeenCalled();
    });

    it("should return DelayedJobDto for multiple polygons", async () => {
      const requestedUuids = ["polygon-uuid-1", "polygon-uuid-2", "polygon-uuid-3"];
      const fixablePolygonUuids = ["polygon-uuid-1", "polygon-uuid-2"];
      const siteUuid = "site-uuid-1";
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
      jest.spyOn(SitePolygon, "findAll").mockResolvedValue([{ siteUuid } as SitePolygon, { siteUuid } as SitePolygon]);
      jest.spyOn(Site, "findAll").mockResolvedValue([
        {
          id: 1,
          uuid: siteUuid,
          name: "Test Site",
          projectId: 1,
          project: {
            id: 1,
            uuid: "project-uuid-1",
            name: "Test Project"
          } as Project
        } as Site
      ]);
      mockQueue.add.mockResolvedValue({ id: "job-1" } as Job);

      const result = await controller.createPolygonListClippedVersions(payloadMultiple, { authenticatedUserId: 1 });

      expect(clippingService.filterFixablePolygonsFromList).toHaveBeenCalledWith(requestedUuids);
      expect(SitePolygon.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            polygonUuid: fixablePolygonUuids,
            isActive: true
          },
          attributes: ["siteUuid"]
        })
      );
      expect(Site.findAll).toHaveBeenCalled();
      expect(mockQueue.add).toHaveBeenCalledWith(
        "clipAndVersion",
        expect.objectContaining({
          polygonUuids: fixablePolygonUuids
        })
      );
      expect(result).toBeDefined();
      expect(result.id).toBe("job-uuid-123");
    });

    it("should set entityName to site name when all polygons belong to same site", async () => {
      const requestedUuids = ["polygon-uuid-1", "polygon-uuid-2"];
      const fixablePolygonUuids = ["polygon-uuid-1", "polygon-uuid-2"];
      const siteUuid = "site-uuid-1";
      const siteName = "Test Site Name";
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
      jest.spyOn(SitePolygon, "findAll").mockResolvedValue([{ siteUuid } as SitePolygon, { siteUuid } as SitePolygon]);
      jest.spyOn(Site, "findAll").mockResolvedValue([
        {
          id: 1,
          uuid: siteUuid,
          name: siteName,
          projectId: 1,
          project: {
            id: 1,
            uuid: "project-uuid-1",
            name: "Test Project"
          } as Project
        } as Site
      ]);
      jest.spyOn(DelayedJob, "create").mockResolvedValue({
        id: 1,
        uuid: "job-uuid-123",
        name: "Polygon Clipping",
        totalContent: 2,
        processedContent: 0,
        progressMessage: "Starting clipping...",
        metadata: {
          entity_id: 1,
          entity_type: Site.LARAVEL_TYPE,
          entity_name: siteName
        },
        isAcknowledged: false,
        createdBy: 1
      } as unknown as DelayedJob);
      mockQueue.add.mockResolvedValue({ id: "job-1" } as Job);

      await controller.createPolygonListClippedVersions(payloadMultiple, { authenticatedUserId: 1 });

      expect(DelayedJob.create).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            entity_id: 1,
            entity_type: Site.LARAVEL_TYPE,
            entity_name: siteName
          })
        })
      );
      expect(mockQueue.add).toHaveBeenCalledWith(
        "clipAndVersion",
        expect.objectContaining({
          siteUuid
        })
      );
    });

    it("should set entityName to project name when polygons belong to same project but different sites", async () => {
      const requestedUuids = ["polygon-uuid-1", "polygon-uuid-2"];
      const fixablePolygonUuids = ["polygon-uuid-1", "polygon-uuid-2"];
      const siteUuid1 = "site-uuid-1";
      const siteUuid2 = "site-uuid-2";
      const projectName = "Test Project Name";
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
      jest
        .spyOn(SitePolygon, "findAll")
        .mockResolvedValue([{ siteUuid: siteUuid1 } as SitePolygon, { siteUuid: siteUuid2 } as SitePolygon]);
      jest.spyOn(Site, "findAll").mockResolvedValue([
        {
          id: 1,
          uuid: siteUuid1,
          name: "Site 1",
          projectId: 1,
          project: {
            id: 1,
            uuid: "project-uuid-1",
            name: projectName
          } as Project
        } as Site,
        {
          id: 2,
          uuid: siteUuid2,
          name: "Site 2",
          projectId: 1,
          project: {
            id: 1,
            uuid: "project-uuid-1",
            name: projectName
          } as Project
        } as Site
      ]);
      jest.spyOn(DelayedJob, "create").mockResolvedValue({
        id: 1,
        uuid: "job-uuid-123",
        name: "Polygon Clipping",
        totalContent: 2,
        processedContent: 0,
        progressMessage: "Starting clipping...",
        metadata: {
          entity_id: 1,
          entity_type: Project.LARAVEL_TYPE,
          entity_name: projectName
        },
        isAcknowledged: false,
        createdBy: 1
      } as unknown as DelayedJob);
      mockQueue.add.mockResolvedValue({ id: "job-1" } as Job);

      await controller.createPolygonListClippedVersions(payloadMultiple, { authenticatedUserId: 1 });

      expect(DelayedJob.create).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            entity_id: 1,
            entity_type: Project.LARAVEL_TYPE,
            entity_name: projectName
          })
        })
      );
    });

    it("should set entityName to polygon count when polygons belong to different projects", async () => {
      const requestedUuids = ["polygon-uuid-1", "polygon-uuid-2"];
      const fixablePolygonUuids = ["polygon-uuid-1", "polygon-uuid-2"];
      const siteUuid1 = "site-uuid-1";
      const siteUuid2 = "site-uuid-2";
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
      jest
        .spyOn(SitePolygon, "findAll")
        .mockResolvedValue([{ siteUuid: siteUuid1 } as SitePolygon, { siteUuid: siteUuid2 } as SitePolygon]);
      jest.spyOn(Site, "findAll").mockResolvedValue([
        {
          id: 1,
          uuid: siteUuid1,
          name: "Site 1",
          projectId: 1,
          project: {
            id: 1,
            uuid: "project-uuid-1",
            name: "Project 1"
          } as Project
        } as Site,
        {
          id: 2,
          uuid: siteUuid2,
          name: "Site 2",
          projectId: 2,
          project: {
            id: 2,
            uuid: "project-uuid-2",
            name: "Project 2"
          } as Project
        } as Site
      ]);
      jest.spyOn(DelayedJob, "create").mockResolvedValue({
        id: 1,
        uuid: "job-uuid-123",
        name: "Polygon Clipping",
        totalContent: 2,
        processedContent: 0,
        progressMessage: "Starting clipping...",
        metadata: {
          entity_name: "2 polygons"
        },
        isAcknowledged: false,
        createdBy: 1
      } as unknown as DelayedJob);
      mockQueue.add.mockResolvedValue({ id: "job-1" } as Job);

      await controller.createPolygonListClippedVersions(payloadMultiple, { authenticatedUserId: 1 });

      expect(DelayedJob.create).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            entity_name: "2 polygons"
          })
        })
      );
    });

    it("should set entityName to polygon count when no site polygons found", async () => {
      const requestedUuids = ["polygon-uuid-1", "polygon-uuid-2"];
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
      jest.spyOn(SitePolygon, "findAll").mockResolvedValue([]);
      jest.spyOn(DelayedJob, "create").mockResolvedValue({
        id: 1,
        uuid: "job-uuid-123",
        name: "Polygon Clipping",
        totalContent: 2,
        processedContent: 0,
        progressMessage: "Starting clipping...",
        metadata: {
          entity_name: "2 polygons"
        },
        isAcknowledged: false,
        createdBy: 1
      } as unknown as DelayedJob);
      mockQueue.add.mockResolvedValue({ id: "job-1" } as Job);

      await controller.createPolygonListClippedVersions(payloadMultiple, { authenticatedUserId: 1 });

      expect(DelayedJob.create).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            entity_name: "2 polygons"
          })
        })
      );
    });

    it("should handle user with null fullName in polygon list endpoint", async () => {
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
      jest.spyOn(User, "findByPk").mockResolvedValue({
        id: 1,
        fullName: null,
        getSourceFromRoles: jest.fn().mockReturnValue("terramatch")
      } as unknown as User);

      const result = await controller.createPolygonListClippedVersions(payload, { authenticatedUserId: 1 });

      expect(result).toBeDefined();
      expect(clippingService.clipAndCreateVersions).toHaveBeenCalledWith(fixablePolygonUuids, 1, null, "terramatch");
    });

    it("should handle user not found (null user) in polygon list endpoint", async () => {
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
      jest.spyOn(User, "findByPk").mockResolvedValue(null);

      const result = await controller.createPolygonListClippedVersions(payload, { authenticatedUserId: 1 });

      expect(result).toBeDefined();
      expect(clippingService.clipAndCreateVersions).toHaveBeenCalledWith(fixablePolygonUuids, 1, null, "terramatch");
    });

    it("should handle user with null getSourceFromRoles in polygon list endpoint", async () => {
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
      jest.spyOn(User, "findByPk").mockResolvedValue({
        id: 1,
        fullName: "Test User",
        getSourceFromRoles: jest.fn().mockReturnValue(null)
      } as unknown as User);

      const result = await controller.createPolygonListClippedVersions(payload, { authenticatedUserId: 1 });

      expect(result).toBeDefined();
      expect(clippingService.clipAndCreateVersions).toHaveBeenCalledWith(
        fixablePolygonUuids,
        1,
        "Test User",
        "terramatch"
      );
    });
  });
});

import { Test } from "@nestjs/testing";
import { createMock, DeepMocked } from "@golevelup/ts-jest";
import { AuditStatusController } from "./audit-status.controller";
import { AuditStatusService } from "./audit-status.service";
import { PolicyService } from "@terramatch-microservices/common";
import { NotFoundException, UnauthorizedException, BadRequestException } from "@nestjs/common";
import {
  ProjectFactory,
  SitePolygonFactory,
  SiteFactory,
  AuditStatusFactory
} from "@terramatch-microservices/database/factories";
import { AuditStatusDto } from "./dto/audit-status.dto";
import { serialize } from "@terramatch-microservices/common/util/testing";
import { Resource } from "@terramatch-microservices/common/util";
import { LaravelModel } from "@terramatch-microservices/database/types/util";
import { EntitiesService } from "./entities.service";
import { Media } from "@terramatch-microservices/database/entities/media.entity";
import { MediaDto } from "@terramatch-microservices/common/dto/media.dto";
import { CollectionModelCtor } from "@terramatch-microservices/database/types/util";
import { CreateAuditStatusBody } from "./dto/audit-status.dto";

describe("AuditStatusController", () => {
  let controller: AuditStatusController;
  let service: DeepMocked<AuditStatusService>;
  let policyService: DeepMocked<PolicyService>;
  let entitiesService: DeepMocked<EntitiesService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [AuditStatusController],
      providers: [
        { provide: AuditStatusService, useValue: (service = createMock<AuditStatusService>()) },
        { provide: PolicyService, useValue: (policyService = createMock<PolicyService>()) },
        { provide: EntitiesService, useValue: (entitiesService = createMock<EntitiesService>()) }
      ]
    }).compile();

    controller = module.get(AuditStatusController);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("getAuditStatuses", () => {
    it("should return audit statuses for a project", async () => {
      const project = await ProjectFactory.create();
      const auditStatuses = [
        new AuditStatusDto(1, "uuid-1", "approved", "John", "Doe", "Comment", "status", new Date(), [])
      ];

      const mockEntity = { id: project.id, uuid: project.uuid } as unknown as LaravelModel;
      service.resolveEntity.mockResolvedValue(mockEntity);
      service.getAuditStatuses.mockResolvedValue(auditStatuses);
      policyService.authorize.mockResolvedValue();

      const result = serialize(await controller.getAuditStatuses({ entity: "projects", uuid: project.uuid }));

      expect(service.resolveEntity).toHaveBeenCalledWith("projects", project.uuid);
      expect(service.getAuditStatuses).toHaveBeenCalledWith(mockEntity, "projects", project.uuid);
      expect(policyService.authorize).toHaveBeenCalledWith("read", expect.anything());
      expect(result.data).toHaveLength(1);
      expect((result.data as Resource[])[0].id).toBe("uuid-1");
    });

    it("should return audit statuses for sitePolygons", async () => {
      const site = await SiteFactory.create();
      const sitePolygon = await SitePolygonFactory.create({ siteUuid: site.uuid });
      const auditStatuses = [new AuditStatusDto(1, "uuid-1", "approved", null, null, "Comment", null, new Date(), [])];

      const mockEntity = { id: 1, uuid: sitePolygon.uuid } as unknown as LaravelModel;
      service.resolveEntity.mockResolvedValue(mockEntity);
      service.getAuditStatuses.mockResolvedValue(auditStatuses);
      policyService.authorize.mockResolvedValue();

      const result = serialize(await controller.getAuditStatuses({ entity: "sitePolygons", uuid: sitePolygon.uuid }));

      expect(service.resolveEntity).toHaveBeenCalledWith("sitePolygons", sitePolygon.uuid);
      expect(service.getAuditStatuses).toHaveBeenCalledWith(mockEntity, "sitePolygons", sitePolygon.uuid);
      expect(result.data).toHaveLength(1);
    });

    it("should throw NotFoundException for non-existent entity", async () => {
      service.resolveEntity.mockRejectedValue(new NotFoundException());
      await expect(controller.getAuditStatuses({ entity: "projects", uuid: "non-existent-uuid" })).rejects.toThrow(
        NotFoundException
      );
    });

    it("should throw UnauthorizedException when user cannot read entity", async () => {
      const project = await ProjectFactory.create();
      const mockEntity = { id: project.id, uuid: project.uuid } as unknown as LaravelModel;
      service.resolveEntity.mockResolvedValue(mockEntity);
      policyService.authorize.mockRejectedValue(new UnauthorizedException());

      await expect(controller.getAuditStatuses({ entity: "projects", uuid: project.uuid })).rejects.toThrow(
        UnauthorizedException
      );
    });

    it("should return empty array when no audit statuses exist", async () => {
      const project = await ProjectFactory.create();
      const mockEntity = { id: project.id, uuid: project.uuid } as unknown as LaravelModel;
      service.resolveEntity.mockResolvedValue(mockEntity);
      service.getAuditStatuses.mockResolvedValue([]);
      policyService.authorize.mockResolvedValue();

      const result = serialize(await controller.getAuditStatuses({ entity: "projects", uuid: project.uuid }));

      expect(result.data).toHaveLength(0);
    });

    it("should return JSON:API format with multiple audit statuses", async () => {
      const project = await ProjectFactory.create();
      const auditStatuses = [
        new AuditStatusDto(1, "uuid-1", "approved", "John", "Doe", "Comment 1", "status", new Date(), []),
        new AuditStatusDto(2, "uuid-2", "draft", "Jane", "Smith", "Comment 2", "updated", new Date(), [])
      ];

      const mockEntity = { id: project.id, uuid: project.uuid } as unknown as LaravelModel;
      service.resolveEntity.mockResolvedValue(mockEntity);
      service.getAuditStatuses.mockResolvedValue(auditStatuses);
      policyService.authorize.mockResolvedValue();

      const result = serialize(await controller.getAuditStatuses({ entity: "projects", uuid: project.uuid }));

      expect(result.data).toHaveLength(2);
      expect((result.data as Resource[])[0].type).toBe("auditStatuses");
      expect((result.data as Resource[])[1].type).toBe("auditStatuses");
    });
  });

  describe("createAuditStatus", () => {
    it("should create audit status and return JSON:API response", async () => {
      const project = await ProjectFactory.create();
      const auditStatus = await AuditStatusFactory.project(project).create();
      const mockEntity = { id: project.id, uuid: project.uuid } as unknown as LaravelModel;

      service.resolveEntity.mockResolvedValue(mockEntity);
      service.createAuditStatus.mockResolvedValue(auditStatus);
      policyService.authorize.mockResolvedValue();
      const mockCollection = {
        findAll: jest.fn().mockResolvedValue([])
      } as unknown as CollectionModelCtor<Media>;
      const mockMediaFor = {
        collection: jest.fn().mockReturnValue(mockCollection)
      } as unknown as ReturnType<typeof Media.for>;
      jest.spyOn(Media, "for").mockReturnValue(mockMediaFor);
      entitiesService.mediaDto.mockReturnValue(
        new MediaDto({} as Media, {
          url: "",
          thumbUrl: null,
          entityType: "projects",
          entityUuid: project.uuid
        })
      );

      const payload = {
        data: {
          type: "auditStatuses",
          attributes: {
            status: "approved",
            comment: "Test comment",
            type: "status"
          }
        }
      };

      const result = serialize(await controller.createAuditStatus({ entity: "projects", uuid: project.uuid }, payload));

      expect(service.resolveEntity).toHaveBeenCalledWith("projects", project.uuid);
      expect(service.createAuditStatus).toHaveBeenCalledWith(mockEntity, payload.data.attributes);
      expect(policyService.authorize).toHaveBeenCalledWith("read", mockEntity);
      expect((result.data as Resource).id).toBe(auditStatus.uuid);
      expect((result.data as Resource).type).toBe("auditStatuses");
    });

    it("should throw BadRequestException for invalid payload type", async () => {
      const payload = {
        data: {
          type: "invalidType",
          attributes: { status: "approved" }
        }
      };

      await expect(
        controller.createAuditStatus({ entity: "projects", uuid: "uuid" }, payload as CreateAuditStatusBody)
      ).rejects.toThrow(BadRequestException);
    });

    it("should throw NotFoundException for non-existent entity", async () => {
      service.resolveEntity.mockRejectedValue(new NotFoundException());
      const payload = {
        data: {
          type: "auditStatuses",
          attributes: { status: "approved" }
        }
      };

      await expect(controller.createAuditStatus({ entity: "projects", uuid: "non-existent" }, payload)).rejects.toThrow(
        NotFoundException
      );
    });

    it("should throw UnauthorizedException when user cannot read entity", async () => {
      const project = await ProjectFactory.create();
      const mockEntity = { id: project.id, uuid: project.uuid } as unknown as LaravelModel;
      service.resolveEntity.mockResolvedValue(mockEntity);
      policyService.authorize.mockRejectedValue(new UnauthorizedException());
      const payload = {
        data: {
          type: "auditStatuses",
          attributes: { status: "approved" }
        }
      };

      await expect(controller.createAuditStatus({ entity: "projects", uuid: project.uuid }, payload)).rejects.toThrow(
        UnauthorizedException
      );
    });
  });
});

import { Test } from "@nestjs/testing";
import { createMock, DeepMocked } from "@golevelup/ts-jest";
import { AuditStatusService } from "./audit-status.service";
import { EntitiesService } from "./entities.service";
import { AuditStatus } from "@terramatch-microservices/database/entities/audit-status.entity";
import { Audit } from "@terramatch-microservices/database/entities/audit.entity";
import { Media } from "@terramatch-microservices/database/entities/media.entity";
import { SitePolygon } from "@terramatch-microservices/database/entities/site-polygon.entity";
import {
  AuditStatusFactory,
  AuditFactory,
  ProjectFactory,
  SiteFactory,
  SitePolygonFactory,
  UserFactory
} from "@terramatch-microservices/database/factories";
import { NotFoundException } from "@nestjs/common";
import { DateTime } from "luxon";
import { MediaDto } from "@terramatch-microservices/common/dto/media.dto";
import { InferCreationAttributes } from "sequelize";
import { EntityType } from "@terramatch-microservices/database/constants/entities";

describe("AuditStatusService", () => {
  let service: AuditStatusService;
  let entitiesService: DeepMocked<EntitiesService>;

  beforeEach(async () => {
    await AuditStatus.destroy({ where: {}, force: true });
    await Audit.destroy({ where: {}, force: true });

    const module = await Test.createTestingModule({
      providers: [
        AuditStatusService,
        { provide: EntitiesService, useValue: (entitiesService = createMock<EntitiesService>()) }
      ]
    }).compile();

    service = module.get(AuditStatusService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("getAuditStatuses", () => {
    it("should return modern audit statuses for a project", async () => {
      const project = await ProjectFactory.create();
      const auditStatus = await AuditStatusFactory.project(project).create({
        status: "approved",
        comment: "Test comment",
        type: "status"
      });

      const entity = await service.resolveEntity("projects", project.uuid);
      const result = await service.getAuditStatuses(entity, "projects", project.uuid);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(auditStatus.id);
      expect(result[0].status).toBe("approved");
      expect(result[0].comment).toBe("Test comment");
    });

    it("should transform status 'started' to 'Draft'", async () => {
      const project = await ProjectFactory.create();
      await AuditStatusFactory.project(project).create({ status: "started" });

      const entity = await service.resolveEntity("projects", project.uuid);
      const result = await service.getAuditStatuses(entity, "projects", project.uuid);

      expect(result[0].status).toBe("Draft");
    });

    it("should include media attachments", async () => {
      const project = await ProjectFactory.create();
      const auditStatus = await AuditStatusFactory.project(project).create();
      const media = await Media.create({
        modelType: AuditStatus.LARAVEL_TYPE,
        modelId: auditStatus.id,
        collectionName: "attachments",
        name: "test-attachment",
        fileName: "test.jpg",
        size: 1000,
        isPublic: true,
        isCover: false,
        fileType: "media",
        customProperties: {},
        disk: "s3",
        manipulation: []
      } as unknown as InferCreationAttributes<Media>);

      const mediaDto = new MediaDto(media, {
        url: "http://example.com/test.jpg",
        thumbUrl: "http://example.com/thumb.jpg",
        entityType: "projects",
        entityUuid: project.uuid
      });
      entitiesService.mediaDto.mockReturnValue(mediaDto);

      const entity = await service.resolveEntity("projects", project.uuid);
      const result = await service.getAuditStatuses(entity, "projects", project.uuid);

      expect(result[0].attachments).toHaveLength(1);
      expect(entitiesService.mediaDto).toHaveBeenCalled();
    });

    it("should return legacy audits before 2024-09-01", async () => {
      const project = await ProjectFactory.create();
      const oldDate = DateTime.fromISO("2024-08-01").toJSDate();
      await AuditFactory.project(project).create({
        createdAt: oldDate,
        updatedAt: oldDate,
        newValues: { status: "approved", feedback: "Good work" }
      });

      const entity = await service.resolveEntity("projects", project.uuid);
      const result = await service.getAuditStatuses(entity, "projects", project.uuid);

      expect(result).toHaveLength(1);
      expect(result[0].uuid).toContain("legacy-");
      expect(result[0].comment).toContain("approved");
    });

    it("should exclude legacy audits after 2024-09-01", async () => {
      const project = await ProjectFactory.create();
      const newDate = DateTime.fromISO("2024-10-01").toJSDate();
      await AuditFactory.project(project).create({
        createdAt: newDate,
        updatedAt: newDate,
        newValues: { status: "approved" }
      });

      const entity = await service.resolveEntity("projects", project.uuid);
      const result = await service.getAuditStatuses(entity, "projects", project.uuid);

      expect(result).toHaveLength(0);
    });

    it("should merge modern and legacy records", async () => {
      const project = await ProjectFactory.create();
      const oldDate = DateTime.fromISO("2024-08-01").toJSDate();
      await AuditStatusFactory.project(project).create({ status: "approved" });
      await AuditFactory.project(project).create({
        createdAt: oldDate,
        updatedAt: oldDate,
        newValues: { status: "draft" }
      });

      const entity = await service.resolveEntity("projects", project.uuid);
      const result = await service.getAuditStatuses(entity, "projects", project.uuid);

      expect(result.length).toBeGreaterThanOrEqual(2);
    });

    it("should sort by dateCreated DESC", async () => {
      const project = await ProjectFactory.create();
      const older = await AuditStatusFactory.project(project).create({
        createdAt: DateTime.now().minus({ days: 10 }).toJSDate()
      });
      const newer = await AuditStatusFactory.project(project).create({
        createdAt: DateTime.now().minus({ days: 5 }).toJSDate()
      });

      const entity = await service.resolveEntity("projects", project.uuid);
      const result = await service.getAuditStatuses(entity, "projects", project.uuid);

      expect(result[0].id).toBe(newer.id);
      expect(result[1].id).toBe(older.id);
    });

    it("should deduplicate by comment (match V2 behavior)", async () => {
      const project = await ProjectFactory.create();
      await AuditStatusFactory.project(project).create({
        comment: "Same comment",
        dateCreated: DateTime.now().minus({ days: 5 }).toJSDate()
      });
      await AuditStatusFactory.project(project).create({
        comment: "Same comment",
        dateCreated: DateTime.now().minus({ days: 10 }).toJSDate()
      });

      const entity = await service.resolveEntity("projects", project.uuid);
      const result = await service.getAuditStatuses(entity, "projects", project.uuid);

      expect(result).toHaveLength(1);
      expect(result[0].comment).toBe("Same comment");
    });

    it("should handle null comments in deduplication", async () => {
      const project = await ProjectFactory.create();
      await AuditStatusFactory.project(project).createMany(2, { comment: null });

      const entity = await service.resolveEntity("projects", project.uuid);
      const result = await service.getAuditStatuses(entity, "projects", project.uuid);

      expect(result).toHaveLength(1);
    });

    it("should lookup user data for legacy audits", async () => {
      const project = await ProjectFactory.create();
      const user = await UserFactory.create();
      const oldDate = DateTime.fromISO("2024-08-01").toJSDate();
      await AuditFactory.project(project).create({
        userId: user.id,
        createdAt: oldDate,
        updatedAt: oldDate,
        newValues: { status: "approved" }
      });

      const entity = await service.resolveEntity("projects", project.uuid);
      const result = await service.getAuditStatuses(entity, "projects", project.uuid);

      expect(result[0].firstName).toBe(user.firstName);
      expect(result[0].lastName).toBe(user.lastName);
    });

    it("should handle missing user for legacy audits", async () => {
      const project = await ProjectFactory.create();
      const oldDate = DateTime.fromISO("2024-08-01").toJSDate();
      await AuditFactory.project(project).create({
        userId: 99999,
        createdAt: oldDate,
        updatedAt: oldDate,
        newValues: { status: "approved" }
      });

      const entity = await service.resolveEntity("projects", project.uuid);
      const result = await service.getAuditStatuses(entity, "projects", project.uuid);

      expect(result[0].firstName).toBeNull();
      expect(result[0].lastName).toBeNull();
    });

    it("should handle sitePolygons entity type", async () => {
      const site = await SiteFactory.create();
      const sitePolygon = await SitePolygonFactory.create({ siteUuid: site.uuid });
      await AuditStatus.create({
        auditableType: SitePolygon.LARAVEL_TYPE,
        auditableId: sitePolygon.id,
        status: "approved",
        comment: "Test comment",
        type: "status"
      } as InferCreationAttributes<AuditStatus>);

      const entity = await service.resolveEntity("sitePolygons", sitePolygon.uuid);
      const result = await service.getAuditStatuses(entity, "sitePolygons", sitePolygon.uuid);

      expect(result.length).toBeGreaterThanOrEqual(1);
    });

    it("should throw NotFoundException for invalid entity type", async () => {
      await expect(service.resolveEntity("invalidType" as EntityType, "uuid")).rejects.toThrow(NotFoundException);
    });

    it("should throw NotFoundException for non-existent entity", async () => {
      await expect(service.resolveEntity("projects", "non-existent-uuid")).rejects.toThrow(NotFoundException);
    });

    it("should handle legacy audit with invalid JSON in newValues", async () => {
      const project = await ProjectFactory.create();
      const oldDate = DateTime.fromISO("2024-08-01").toJSDate();
      const audit = await AuditFactory.project(project).create({
        createdAt: oldDate,
        updatedAt: oldDate
      });
      // Simulate invalid JSON by setting newValues to null
      await audit.update({ newValues: null });

      const entity = await service.resolveEntity("projects", project.uuid);
      const result = await service.getAuditStatuses(entity, "projects", project.uuid);

      expect(result).toHaveLength(1);
      expect(result[0].comment).toBeNull();
    });

    it("should construct comment from status and feedback in legacy audits", async () => {
      const project = await ProjectFactory.create();
      const oldDate = DateTime.fromISO("2024-08-01").toJSDate();
      await AuditFactory.project(project).create({
        createdAt: oldDate,
        updatedAt: oldDate,
        newValues: { status: "approved", feedback: "Great job" }
      });

      const entity = await service.resolveEntity("projects", project.uuid);
      const result = await service.getAuditStatuses(entity, "projects", project.uuid);

      expect(result[0].comment).toBe("approved: Great job");
    });

    it("should replace hyphens with spaces in legacy audit comments", async () => {
      const project = await ProjectFactory.create();
      const oldDate = DateTime.fromISO("2024-08-01").toJSDate();
      await AuditFactory.project(project).create({
        createdAt: oldDate,
        updatedAt: oldDate,
        newValues: { status: "needs-more-information", feedback: "please-update" }
      });

      const entity = await service.resolveEntity("projects", project.uuid);
      const result = await service.getAuditStatuses(entity, "projects", project.uuid);

      expect(result[0].comment).toBe("needs more information: please update");
    });
  });

  describe("getAuditStatusesForApplicationHistory", () => {
    it("should return empty map for empty entities array", async () => {
      const result = await service.getAuditStatusesForApplicationHistory([]);
      expect(result.size).toBe(0);
    });

    it("should group audit statuses by entity ID", async () => {
      const project1 = await ProjectFactory.create();
      const project2 = await ProjectFactory.create();
      await AuditStatusFactory.project(project1).create({ status: "approved" });
      await AuditStatusFactory.project(project2).create({ status: "draft" });

      const result = await service.getAuditStatusesForApplicationHistory([project1, project2]);

      expect(result.size).toBe(2);
      expect(result.get(project1.id)).toHaveLength(1);
      expect(result.get(project2.id)).toHaveLength(1);
      expect(result.get(project1.id)?.[0].status).toBe("approved");
      expect(result.get(project2.id)?.[0].status).toBe("draft");
    });

    it("should include both modern and legacy audits grouped by entity", async () => {
      const project = await ProjectFactory.create();
      const oldDate = DateTime.fromISO("2024-08-01").toJSDate();
      await AuditStatusFactory.project(project).create({ status: "approved" });
      await AuditFactory.project(project).create({
        createdAt: oldDate,
        updatedAt: oldDate,
        newValues: { status: "draft" }
      });

      const result = await service.getAuditStatusesForApplicationHistory([project]);

      expect(result.get(project.id)).toHaveLength(2);
      const statuses = result.get(project.id) ?? [];
      expect(statuses.some(s => s.uuid.startsWith("legacy-"))).toBe(true);
      expect(statuses.some(s => !s.uuid.startsWith("legacy-"))).toBe(true);
    });

    it("should not include media attachments", async () => {
      const project = await ProjectFactory.create();
      const auditStatus = await AuditStatusFactory.project(project).create();
      await Media.create({
        modelType: AuditStatus.LARAVEL_TYPE,
        modelId: auditStatus.id,
        collectionName: "attachments",
        name: "test-attachment",
        fileName: "test.jpg",
        size: 1000,
        isPublic: true,
        isCover: false,
        fileType: "media",
        customProperties: {},
        disk: "s3",
        manipulation: []
      } as unknown as InferCreationAttributes<Media>);

      const result = await service.getAuditStatusesForApplicationHistory([project]);

      expect(result.get(project.id)?.[0].attachments).toHaveLength(0);
      expect(entitiesService.mediaDto).not.toHaveBeenCalled();
    });

    it("should not deduplicate by comment", async () => {
      const project = await ProjectFactory.create();
      await AuditStatusFactory.project(project).create({
        comment: "Same comment",
        dateCreated: DateTime.now().minus({ days: 5 }).toJSDate()
      });
      await AuditStatusFactory.project(project).create({
        comment: "Same comment",
        dateCreated: DateTime.now().minus({ days: 10 }).toJSDate()
      });

      const result = await service.getAuditStatusesForApplicationHistory([project]);

      expect(result.get(project.id)).toHaveLength(2);
    });

    it("should handle multiple entities with multiple audit statuses", async () => {
      const project1 = await ProjectFactory.create();
      const project2 = await ProjectFactory.create();
      await AuditStatusFactory.project(project1).createMany(3);
      await AuditStatusFactory.project(project2).createMany(2);

      const result = await service.getAuditStatusesForApplicationHistory([project1, project2]);

      expect(result.get(project1.id)).toHaveLength(3);
      expect(result.get(project2.id)).toHaveLength(2);
    });
  });
});

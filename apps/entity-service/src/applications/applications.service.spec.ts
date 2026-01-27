import { Test } from "@nestjs/testing";
import { createMock, DeepMocked } from "@golevelup/ts-jest";
import { ApplicationsService } from "./applications.service";
import { AuditStatusService } from "../entities/audit-status.service";
import { ApplicationFactory, FormSubmissionFactory, StageFactory } from "@terramatch-microservices/database/factories";
import { AuditStatusDto } from "../entities/dto/audit-status.dto";
import { DateTime } from "luxon";

describe("ApplicationsService", () => {
  let service: ApplicationsService;
  let auditStatusService: DeepMocked<AuditStatusService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        ApplicationsService,
        { provide: AuditStatusService, useValue: (auditStatusService = createMock<AuditStatusService>()) }
      ]
    }).compile();

    service = module.get(ApplicationsService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("getApplicationHistory", () => {
    it("should return empty history for application with no submissions", async () => {
      const app = await ApplicationFactory.create();

      const result = await service.getApplicationHistory(app);

      expect(result).toHaveLength(0);
    });

    it("should return history entries from submissions in reverse order", async () => {
      const app = await ApplicationFactory.create();
      const stage = await StageFactory.create();
      const sub1 = await FormSubmissionFactory.create({
        applicationId: app.id,
        stageUuid: stage.uuid,
        createdAt: DateTime.now().minus({ days: 10 }).toJSDate()
      });
      const sub2 = await FormSubmissionFactory.create({
        applicationId: app.id,
        stageUuid: stage.uuid,
        createdAt: DateTime.now().minus({ days: 5 }).toJSDate()
      });

      const dto1 = new AuditStatusDto(1, "uuid-1", "approved", null, null, "Comment 1", "status", new Date(), []);
      const dto2 = new AuditStatusDto(2, "uuid-2", "draft", null, null, "Comment 2", "status", new Date(), []);

      auditStatusService.getAuditStatusesForApplicationHistory.mockResolvedValue(
        new Map([
          [sub1.id, [dto1]],
          [sub2.id, [dto2]]
        ])
      );

      const result = await service.getApplicationHistory(app);

      expect(result).toHaveLength(2);
      expect(auditStatusService.getAuditStatusesForApplicationHistory).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ id: sub1.id }), expect.objectContaining({ id: sub2.id })])
      );
    });

    it("should skip entries newer than earliest history entry", async () => {
      const app = await ApplicationFactory.create();
      const stage = await StageFactory.create();
      const sub1 = await FormSubmissionFactory.create({
        applicationId: app.id,
        stageUuid: stage.uuid,
        createdAt: DateTime.now().minus({ days: 10 }).toJSDate()
      });
      const sub2 = await FormSubmissionFactory.create({
        applicationId: app.id,
        stageUuid: stage.uuid,
        createdAt: DateTime.now().minus({ days: 5 }).toJSDate()
      });

      const olderDate = DateTime.now().minus({ days: 10 }).toJSDate();
      const newerDate = DateTime.now().minus({ days: 5 }).toJSDate();
      const evenNewerDate = DateTime.now().minus({ days: 1 }).toJSDate();

      const olderDto = new AuditStatusDto(1, "uuid-1", null, null, null, null, "updated", olderDate, []);
      const newerDto = new AuditStatusDto(2, "uuid-2", null, null, null, null, "updated", newerDate, []);
      const evenNewerDto = new AuditStatusDto(3, "uuid-3", null, null, null, null, "updated", evenNewerDate, []);

      auditStatusService.getAuditStatusesForApplicationHistory.mockResolvedValue(
        new Map([
          [sub1.id, [olderDto]],
          [sub2.id, [newerDto, evenNewerDto]]
        ])
      );

      const result = await service.getApplicationHistory(app);

      expect(result).toHaveLength(2);
      expect(result.some(e => e.date.getTime() === olderDate.getTime())).toBe(true);
      expect(result.some(e => e.date.getTime() === newerDate.getTime())).toBe(true);
      expect(result.some(e => e.date.getTime() === evenNewerDate.getTime())).toBe(false);
    });

    it("should skip back-to-back updated events within 12 hours", async () => {
      const app = await ApplicationFactory.create();
      const stage = await StageFactory.create();
      const sub = await FormSubmissionFactory.create({ applicationId: app.id, stageUuid: stage.uuid });

      const baseTime = DateTime.now();
      const dto1 = new AuditStatusDto(1, "uuid-1", null, null, null, null, "updated", baseTime.toJSDate(), []);
      const dto2 = new AuditStatusDto(
        2,
        "uuid-2",
        null,
        null,
        null,
        null,
        "updated",
        baseTime.plus({ hours: 6 }).toJSDate(),
        []
      );

      auditStatusService.getAuditStatusesForApplicationHistory.mockResolvedValue(new Map([[sub.id, [dto1, dto2]]]));

      const result = await service.getApplicationHistory(app);

      expect(result).toHaveLength(1);
    });

    it("should include back-to-back updated events if 12+ hours apart", async () => {
      const app = await ApplicationFactory.create();
      const stage = await StageFactory.create();
      const sub = await FormSubmissionFactory.create({ applicationId: app.id, stageUuid: stage.uuid });

      const baseTime = DateTime.now();
      const olderDto = new AuditStatusDto(1, "uuid-1", null, null, null, null, "updated", baseTime.toJSDate(), []);
      const newerDto = new AuditStatusDto(
        2,
        "uuid-2",
        null,
        null,
        null,
        null,
        "updated",
        baseTime.plus({ hours: 13 }).toJSDate(),
        []
      );

      auditStatusService.getAuditStatusesForApplicationHistory.mockResolvedValue(
        new Map([[sub.id, [newerDto, olderDto]]])
      );

      const result = await service.getApplicationHistory(app);

      expect(result).toHaveLength(2);
    });

    it("should replace updated event with started status if within 12 hours", async () => {
      const app = await ApplicationFactory.create();
      const stage = await StageFactory.create();
      const sub = await FormSubmissionFactory.create({ applicationId: app.id, stageUuid: stage.uuid });

      const baseTime = DateTime.now();
      const updatedDto = new AuditStatusDto(1, "uuid-1", null, null, null, null, "updated", baseTime.toJSDate(), []);
      const startedDto = new AuditStatusDto(
        2,
        "uuid-2",
        "Draft",
        null,
        null,
        null,
        "status",
        baseTime.minus({ hours: 6 }).toJSDate(),
        []
      );

      auditStatusService.getAuditStatusesForApplicationHistory.mockResolvedValue(
        new Map([[sub.id, [updatedDto, startedDto]]])
      );

      const result = await service.getApplicationHistory(app);

      expect(result).toHaveLength(1);
      expect(result[0].status).toBe("started");
      expect(result[0].eventType).toBe("status");
    });

    it("should transform Draft status to started", async () => {
      const app = await ApplicationFactory.create();
      const stage = await StageFactory.create();
      const sub = await FormSubmissionFactory.create({ applicationId: app.id, stageUuid: stage.uuid });

      const dto = new AuditStatusDto(1, "uuid-1", "Draft", null, null, "Comment", "status", new Date(), []);

      auditStatusService.getAuditStatusesForApplicationHistory.mockResolvedValue(new Map([[sub.id, [dto]]]));

      const result = await service.getApplicationHistory(app);

      expect(result[0].status).toBe("started");
    });

    it("should determine eventType from status for legacy audits", async () => {
      const app = await ApplicationFactory.create();
      const stage = await StageFactory.create();
      const sub = await FormSubmissionFactory.create({ applicationId: app.id, stageUuid: stage.uuid });

      const legacyDto = new AuditStatusDto(1, "legacy-1", "approved", null, null, "Comment", null, new Date(), []);

      auditStatusService.getAuditStatusesForApplicationHistory.mockResolvedValue(new Map([[sub.id, [legacyDto]]]));

      const result = await service.getApplicationHistory(app);

      expect(result[0].eventType).toBe("status");
    });

    it("should set eventType to updated for legacy audits without status", async () => {
      const app = await ApplicationFactory.create();
      const stage = await StageFactory.create();
      const sub = await FormSubmissionFactory.create({ applicationId: app.id, stageUuid: stage.uuid });

      const legacyDto = new AuditStatusDto(1, "legacy-1", null, null, null, null, null, new Date(), []);

      auditStatusService.getAuditStatusesForApplicationHistory.mockResolvedValue(new Map([[sub.id, [legacyDto]]]));

      const result = await service.getApplicationHistory(app);

      expect(result[0].eventType).toBe("updated");
    });

    it("should include stageName in history entries", async () => {
      const app = await ApplicationFactory.create();
      const stage = await StageFactory.create({ name: "Test Stage" });
      const sub = await FormSubmissionFactory.create({ applicationId: app.id, stageUuid: stage.uuid });

      const dto = new AuditStatusDto(1, "uuid-1", "approved", null, null, "Comment", "status", new Date(), []);

      auditStatusService.getAuditStatusesForApplicationHistory.mockResolvedValue(new Map([[sub.id, [dto]]]));

      const result = await service.getApplicationHistory(app);

      expect(result[0].stageName).toBe("Test Stage");
    });
  });
});

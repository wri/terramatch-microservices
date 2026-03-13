import { Test } from "@nestjs/testing";
import { createMock, DeepMocked } from "@golevelup/ts-jest";
import { getQueueToken } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { NotFoundException } from "@nestjs/common";
import { RemindersService } from "./reminders.service";
import { EntitiesService } from "./entities.service";
import { AuditStatus } from "@terramatch-microservices/database/entities/audit-status.entity";
import { User } from "@terramatch-microservices/database/entities/user.entity";
import { LaravelModel } from "@terramatch-microservices/database/types/util";
import { ENTITY_MODELS } from "@terramatch-microservices/database/constants/entities";
import { ProjectReport } from "@terramatch-microservices/database/entities";
import { v4 as uuidv4 } from "uuid";

function mockEntity(id: number, entityUuid?: string): LaravelModel {
  return {
    id,
    uuid: entityUuid ?? uuidv4(),
    status: "due"
  } as unknown as LaravelModel;
}

function mockUser(overrides: Partial<User> = {}): User {
  return {
    id: 1,
    emailAddress: "admin@example.com",
    firstName: "Admin",
    lastName: "User",
    ...overrides
  } as unknown as User;
}

function mockAuditStatusResult(overrides: Partial<AuditStatus> = {}): AuditStatus {
  return {
    id: 100,
    uuid: uuidv4(),
    type: "reminder-sent",
    comment: null,
    isActive: true,
    ...overrides
  } as unknown as AuditStatus;
}

describe("RemindersService", () => {
  let service: RemindersService;
  let entitiesService: DeepMocked<EntitiesService>;
  let emailQueue: DeepMocked<Queue>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        RemindersService,
        { provide: EntitiesService, useValue: (entitiesService = createMock<EntitiesService>()) },
        { provide: getQueueToken("email"), useValue: (emailQueue = createMock<Queue>()) }
      ]
    }).compile();

    service = module.get(RemindersService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("resolveReminderEntity", () => {
    it("should resolve a project report by UUID", async () => {
      const entityUuid = uuidv4();
      const entity = mockEntity(1, entityUuid);

      jest.spyOn(ENTITY_MODELS.projectReports, "findOne").mockResolvedValue(entity as unknown as ProjectReport);

      const result = await service.resolveReminderEntity("projectReports", entityUuid);

      expect(ENTITY_MODELS.projectReports.findOne).toHaveBeenCalledWith({ where: { uuid: entityUuid } });
      expect(result).toBe(entity);
    });

    it("should resolve a financial report by UUID", async () => {
      const entityUuid = uuidv4();
      const entity = mockEntity(2, entityUuid);

      jest.spyOn(ENTITY_MODELS.financialReports, "findOne").mockResolvedValue(entity as never);

      const result = await service.resolveReminderEntity("financialReports", entityUuid);

      expect(result).toBe(entity);
    });

    it("should throw NotFoundException when entity is not found", async () => {
      jest.spyOn(ENTITY_MODELS.projectReports, "findOne").mockResolvedValue(null);

      await expect(service.resolveReminderEntity("projectReports", "non-existent-uuid")).rejects.toThrow(
        NotFoundException
      );
    });
  });

  describe("sendReminder", () => {
    it("should queue a report reminder email and create an audit status", async () => {
      const user = mockUser();
      const entity = mockEntity(5);
      const expectedAuditStatus = mockAuditStatusResult({ comment: "Feedback: Please complete this" });

      jest.spyOn(User, "findByPk").mockResolvedValue(user as never);
      jest.spyOn(AuditStatus, "create").mockResolvedValue(expectedAuditStatus as never);
      Object.defineProperty(entitiesService, "userId", { get: () => 1 });
      emailQueue.add.mockResolvedValue({} as never);

      const result = await service.sendReminder(entity, "projectReports", "Please complete this");

      expect(emailQueue.add).toHaveBeenCalledWith("adminReportReminder", {
        type: "projectReports",
        id: entity.id,
        feedback: "Please complete this"
      });
      expect(AuditStatus.create).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "reminder-sent",
          comment: "Feedback: Please complete this",
          isActive: true,
          createdBy: "admin@example.com",
          firstName: "Admin",
          lastName: "User"
        })
      );
      expect(result).toBe(expectedAuditStatus);
    });

    it("should queue a financial report reminder email for financialReports", async () => {
      const user = mockUser();
      const entity = mockEntity(10);
      const expectedAuditStatus = mockAuditStatusResult();

      jest.spyOn(User, "findByPk").mockResolvedValue(user as never);
      jest.spyOn(AuditStatus, "create").mockResolvedValue(expectedAuditStatus as never);
      Object.defineProperty(entitiesService, "userId", { get: () => 1 });
      emailQueue.add.mockResolvedValue({} as never);

      await service.sendReminder(entity, "financialReports", null);

      expect(emailQueue.add).toHaveBeenCalledWith("adminFinancialReportReminder", {
        type: "financialReports",
        id: entity.id,
        feedback: null
      });
    });

    it("should set comment to null when feedback is null or blank", async () => {
      const user = mockUser();
      const entity = mockEntity(5);
      const expectedAuditStatus = mockAuditStatusResult({ comment: null });

      jest.spyOn(User, "findByPk").mockResolvedValue(user as never);
      jest.spyOn(AuditStatus, "create").mockResolvedValue(expectedAuditStatus as never);
      Object.defineProperty(entitiesService, "userId", { get: () => 1 });
      emailQueue.add.mockResolvedValue({} as never);

      await service.sendReminder(entity, "projectReports", null);

      expect(AuditStatus.create).toHaveBeenCalledWith(expect.objectContaining({ comment: null }));
    });

    it("should set comment to null when feedback is an empty string", async () => {
      const user = mockUser();
      const entity = mockEntity(5);
      const expectedAuditStatus = mockAuditStatusResult({ comment: null });

      jest.spyOn(User, "findByPk").mockResolvedValue(user as never);
      jest.spyOn(AuditStatus, "create").mockResolvedValue(expectedAuditStatus as never);
      Object.defineProperty(entitiesService, "userId", { get: () => 1 });
      emailQueue.add.mockResolvedValue({} as never);

      await service.sendReminder(entity, "projectReports", "   ");

      expect(AuditStatus.create).toHaveBeenCalledWith(expect.objectContaining({ comment: null }));
    });

    it("should throw NotFoundException when no authenticated user is present", async () => {
      const entity = mockEntity(5);
      Object.defineProperty(entitiesService, "userId", { get: () => null });

      await expect(service.sendReminder(entity, "projectReports", null)).rejects.toThrow(NotFoundException);
    });

    it("should throw NotFoundException when the authenticated user is not found in DB", async () => {
      const entity = mockEntity(5);
      Object.defineProperty(entitiesService, "userId", { get: () => 999 });
      jest.spyOn(User, "findByPk").mockResolvedValue(null);

      await expect(service.sendReminder(entity, "projectReports", null)).rejects.toThrow(NotFoundException);
    });

    it("should store the entity's laravel type in the audit status", async () => {
      const user = mockUser();
      const entity = mockEntity(5);
      const expectedAuditStatus = mockAuditStatusResult();

      jest.spyOn(User, "findByPk").mockResolvedValue(user as never);
      jest.spyOn(AuditStatus, "create").mockResolvedValue(expectedAuditStatus as never);
      Object.defineProperty(entitiesService, "userId", { get: () => 1 });
      emailQueue.add.mockResolvedValue({} as never);

      await service.sendReminder(entity, "projectReports", "feedback");

      expect(AuditStatus.create).toHaveBeenCalledWith(
        expect.objectContaining({
          auditableId: entity.id
        })
      );
    });
  });
});

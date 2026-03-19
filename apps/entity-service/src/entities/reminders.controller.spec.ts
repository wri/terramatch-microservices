import { Test } from "@nestjs/testing";
import { createMock, DeepMocked } from "@golevelup/ts-jest";
import { BadRequestException, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { RemindersController } from "./reminders.controller";
import { RemindersService } from "./reminders.service";
import { PolicyService } from "@terramatch-microservices/common";
import { LaravelModel } from "@terramatch-microservices/database/types/util";
import { serialize } from "@terramatch-microservices/common/util/testing";
import { Resource } from "@terramatch-microservices/common/util";
import { AuditStatus } from "@terramatch-microservices/database/entities/audit-status.entity";
import { CreateReminderBody } from "./dto/reminder.dto";
import { v4 as uuidv4 } from "uuid";

function buildBody(feedback: string | null = null): CreateReminderBody {
  return {
    data: {
      type: "reminders",
      attributes: { feedback }
    }
  } as CreateReminderBody;
}

function mockAuditStatus(overrides: Partial<AuditStatus> = {}): AuditStatus {
  return {
    id: 1,
    uuid: uuidv4(),
    type: "reminder-sent",
    comment: null,
    ...overrides
  } as unknown as AuditStatus;
}

describe("RemindersController", () => {
  let controller: RemindersController;
  let service: DeepMocked<RemindersService>;
  let policyService: DeepMocked<PolicyService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [RemindersController],
      providers: [
        { provide: RemindersService, useValue: (service = createMock<RemindersService>()) },
        { provide: PolicyService, useValue: (policyService = createMock<PolicyService>()) }
      ]
    }).compile();

    controller = module.get(RemindersController);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("sendReminder", () => {
    it("should send a reminder for a project report and return JSON:API response", async () => {
      const entityUuid = uuidv4();
      const auditStatus = mockAuditStatus({ uuid: uuidv4(), comment: "Feedback: Please update" });

      const mockEntity = { id: 1, uuid: entityUuid } as unknown as LaravelModel;
      service.resolveReminderEntity.mockResolvedValue(mockEntity);
      service.sendReminder.mockResolvedValue(auditStatus);
      policyService.authorize.mockResolvedValue();

      const result = serialize(
        await controller.sendReminder({ entity: "projectReports", uuid: entityUuid }, buildBody("Please update"))
      );

      expect(service.resolveReminderEntity).toHaveBeenCalledWith("projectReports", entityUuid);
      expect(policyService.authorize).toHaveBeenCalledWith("sendReminder", mockEntity);
      expect(service.sendReminder).toHaveBeenCalledWith(mockEntity, "projectReports", "Please update");
      expect((result.data as Resource).type).toBe("reminders");
      expect((result.data as Resource).id).toBe(auditStatus.uuid);
    });

    it("should send a reminder for a financial report", async () => {
      const entityUuid = uuidv4();
      const auditStatus = mockAuditStatus();

      const mockEntity = { id: 2, uuid: entityUuid } as unknown as LaravelModel;
      service.resolveReminderEntity.mockResolvedValue(mockEntity);
      service.sendReminder.mockResolvedValue(auditStatus);
      policyService.authorize.mockResolvedValue();

      const result = serialize(
        await controller.sendReminder({ entity: "financialReports", uuid: entityUuid }, buildBody())
      );

      expect(service.resolveReminderEntity).toHaveBeenCalledWith("financialReports", entityUuid);
      expect(service.sendReminder).toHaveBeenCalledWith(mockEntity, "financialReports", null);
      expect((result.data as Resource).type).toBe("reminders");
    });

    it("should pass null feedback when not provided", async () => {
      const entityUuid = uuidv4();
      const mockEntity = { id: 1, uuid: entityUuid } as unknown as LaravelModel;
      service.resolveReminderEntity.mockResolvedValue(mockEntity);
      service.sendReminder.mockResolvedValue(mockAuditStatus());
      policyService.authorize.mockResolvedValue();

      await controller.sendReminder({ entity: "projectReports", uuid: entityUuid }, buildBody(null));

      expect(service.sendReminder).toHaveBeenCalledWith(mockEntity, "projectReports", null);
    });

    it("should throw BadRequestException when payload type is not 'reminders'", async () => {
      const body = {
        data: { type: "wrongType", attributes: { feedback: null } }
      } as unknown as CreateReminderBody;

      await expect(controller.sendReminder({ entity: "projectReports", uuid: uuidv4() }, body)).rejects.toThrow(
        BadRequestException
      );
    });

    it("should throw NotFoundException when entity does not exist", async () => {
      service.resolveReminderEntity.mockRejectedValue(new NotFoundException("Entity not found"));

      await expect(
        controller.sendReminder({ entity: "projectReports", uuid: "non-existent-uuid" }, buildBody())
      ).rejects.toThrow(NotFoundException);
    });

    it("should throw UnauthorizedException when user is not authorised to send reminders", async () => {
      const entityUuid = uuidv4();
      const mockEntity = { id: 1, uuid: entityUuid } as unknown as LaravelModel;
      service.resolveReminderEntity.mockResolvedValue(mockEntity);
      policyService.authorize.mockRejectedValue(new UnauthorizedException());

      await expect(
        controller.sendReminder({ entity: "projectReports", uuid: entityUuid }, buildBody())
      ).rejects.toThrow(UnauthorizedException);
    });

    it("should include entityType, entityUuid and feedback in the response attributes", async () => {
      const entityUuid = uuidv4();
      const auditStatus = mockAuditStatus({ uuid: uuidv4() });

      const mockEntity = { id: 1, uuid: entityUuid } as unknown as LaravelModel;
      service.resolveReminderEntity.mockResolvedValue(mockEntity);
      service.sendReminder.mockResolvedValue(auditStatus);
      policyService.authorize.mockResolvedValue();

      const result = serialize(
        await controller.sendReminder({ entity: "projectReports", uuid: entityUuid }, buildBody("Test feedback"))
      );

      const resource = result.data as Resource;
      expect(resource.attributes["entityType"]).toBe("projectReports");
      expect(resource.attributes["entityUuid"]).toBe(entityUuid);
      expect(resource.attributes["feedback"]).toBe("Test feedback");
    });

    it("should authorize 'sendReminder' action before processing", async () => {
      const entityUuid = uuidv4();
      const mockEntity = { id: 1, uuid: entityUuid } as unknown as LaravelModel;
      service.resolveReminderEntity.mockResolvedValue(mockEntity);
      service.sendReminder.mockResolvedValue(mockAuditStatus());
      policyService.authorize.mockResolvedValue();

      await controller.sendReminder({ entity: "siteReports", uuid: entityUuid }, buildBody());

      expect(policyService.authorize).toHaveBeenCalledWith("sendReminder", mockEntity);
      expect(service.sendReminder).toHaveBeenCalled();
    });
  });
});

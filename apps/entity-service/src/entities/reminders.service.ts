import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { InferCreationAttributes } from "sequelize";
import { AuditStatus } from "@terramatch-microservices/database/entities/audit-status.entity";
import { User } from "@terramatch-microservices/database/entities/user.entity";
import { ENTITY_MODELS } from "@terramatch-microservices/database/constants/entities";
import { LaravelModel, laravelType } from "@terramatch-microservices/database/types/util";
import { AdminReportReminderEmail } from "@terramatch-microservices/common/email/admin-report-reminder.email";
import { AdminFinancialReportReminderEmail } from "@terramatch-microservices/common/email/admin-financial-report-reminder.email";
import { EntitiesService } from "./entities.service";
import { ReminderEntityType } from "./dto/reminder.dto";

@Injectable()
export class RemindersService {
  constructor(
    private readonly entitiesService: EntitiesService,
    @InjectQueue("email") private readonly emailQueue: Queue
  ) {}

  async resolveReminderEntity(entityType: ReminderEntityType, uuid: string): Promise<LaravelModel> {
    const entityModelClass = ENTITY_MODELS[entityType];
    if (entityModelClass == null) {
      throw new NotFoundException(`Entity type not found: ${entityType}`);
    }

    const entity = await entityModelClass.findOne({ where: { uuid } });
    if (entity == null) {
      throw new NotFoundException(`Entity not found: [${entityType}, ${uuid}]`);
    }

    return entity;
  }

  async sendReminder(
    entity: LaravelModel,
    entityType: ReminderEntityType,
    feedback: string | null
  ): Promise<AuditStatus> {
    const userId = this.entitiesService.userId;
    if (userId == null) {
      throw new NotFoundException("Authenticated user not found");
    }

    const user = await User.findByPk(userId, {
      attributes: ["emailAddress", "firstName", "lastName"]
    });
    if (user == null) {
      throw new NotFoundException("User not found");
    }

    const sender =
      entityType === "financialReports"
        ? new AdminFinancialReportReminderEmail({ type: entityType, id: entity.id, feedback })
        : new AdminReportReminderEmail({ type: entityType, id: entity.id, feedback });

    await sender.sendLater(this.emailQueue);

    const comment = feedback != null && feedback.trim() !== "" ? `Feedback: ${feedback}` : null;
    const auditStatus = await AuditStatus.create({
      auditableType: laravelType(entity),
      auditableId: entity.id,
      status: (entity as LaravelModel & { status?: string }).status ?? null,
      comment,
      type: "reminder-sent",
      isActive: true,
      createdBy: user.emailAddress,
      firstName: user.firstName,
      lastName: user.lastName
    } as InferCreationAttributes<AuditStatus>);

    return auditStatus;
  }
}

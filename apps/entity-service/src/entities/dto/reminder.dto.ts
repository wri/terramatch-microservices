import { IsIn, IsOptional, IsString, IsUUID } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
import { JsonApiDto } from "@terramatch-microservices/common/decorators";
import { CreateDataDto, JsonApiBodyDto } from "@terramatch-microservices/common/util/json-api-update-dto";

export const REMINDER_ENTITY_TYPES = [
  "projectReports",
  "siteReports",
  "nurseryReports",
  "financialReports",
  "srpReports"
] as const;
export type ReminderEntityType = (typeof REMINDER_ENTITY_TYPES)[number];

export class ReminderParamsDto {
  @IsIn(REMINDER_ENTITY_TYPES)
  @ApiProperty({
    enum: REMINDER_ENTITY_TYPES,
    description: "Report entity type to send a reminder for"
  })
  entity: ReminderEntityType;

  @IsUUID()
  @ApiProperty({ format: "uuid", description: "UUID of the report entity" })
  uuid: string;
}

export class CreateReminderAttributes {
  @IsOptional()
  @IsString()
  @ApiProperty({
    required: false,
    nullable: true,
    type: String,
    description: "Optional feedback message to include in the reminder email"
  })
  feedback?: string | null;
}

export class CreateReminderBody extends JsonApiBodyDto(
  class CreateReminderData extends CreateDataDto("reminders", CreateReminderAttributes) {}
) {}

@JsonApiDto({ type: "reminders" })
export class ReminderDto {
  @ApiProperty({ description: "UUID of the audit status record created for this reminder" })
  uuid: string;

  @ApiProperty({ description: "The entity type the reminder was sent for" })
  entityType: string;

  @ApiProperty({ description: "The UUID of the entity the reminder was sent for" })
  entityUuid: string;

  @ApiProperty({ nullable: true, type: String, description: "The feedback included in the reminder" })
  feedback: string | null;

  constructor(uuid: string, entityType: string, entityUuid: string, feedback: string | null) {
    this.uuid = uuid;
    this.entityType = entityType;
    this.entityUuid = entityUuid;
    this.feedback = feedback;
  }
}

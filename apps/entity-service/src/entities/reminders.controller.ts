import {
  BadRequestException,
  Body,
  Controller,
  NotFoundException,
  Param,
  Post,
  UnauthorizedException
} from "@nestjs/common";
import { ApiOperation } from "@nestjs/swagger";
import { ExceptionResponse, JsonApiResponse } from "@terramatch-microservices/common/decorators";
import { buildJsonApi } from "@terramatch-microservices/common/util";
import { PolicyService } from "@terramatch-microservices/common";
import { RemindersService } from "./reminders.service";
import { CreateReminderBody, ReminderDto, ReminderParamsDto } from "./dto/reminder.dto";

@Controller("entities/v3/:entity/:uuid/reminders")
export class RemindersController {
  constructor(private readonly remindersService: RemindersService, private readonly policyService: PolicyService) {}

  @Post()
  @ApiOperation({
    operationId: "sendReminder",
    summary: "Send a reminder email for a report entity",
    description:
      "Queues a reminder email to the project or organisation users associated with the given report entity " +
      "and records an audit status entry of type 'reminder-sent'. " +
      "Requires the authenticated user to have the 'sendReminder' permission on the entity."
  })
  @JsonApiResponse(ReminderDto)
  @ExceptionResponse(UnauthorizedException, {
    description: "Authentication failed, or current user is not authorised to send reminders for this entity."
  })
  @ExceptionResponse(NotFoundException, { description: "Entity not found." })
  @ExceptionResponse(BadRequestException, { description: "Request body is malformed." })
  async sendReminder(@Param() { entity, uuid }: ReminderParamsDto, @Body() body: CreateReminderBody) {
    if (body.data.type !== "reminders") {
      throw new BadRequestException("Payload type must be 'reminders'");
    }

    const reportEntity = await this.remindersService.resolveReminderEntity(entity, uuid);
    await this.policyService.authorize("sendReminder", reportEntity);

    const feedback = body.data.attributes.feedback ?? null;
    const auditStatus = await this.remindersService.sendReminder(reportEntity, entity, feedback);

    const dto = new ReminderDto(auditStatus.uuid, entity, uuid, feedback);
    const document = buildJsonApi(ReminderDto);
    document.addData(auditStatus.uuid, dto);
    return document;
  }
}

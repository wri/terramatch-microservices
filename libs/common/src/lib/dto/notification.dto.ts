import { JsonApiDto } from "../decorators";
import { ApiProperty } from "@nestjs/swagger";
import { EVENT_CATEGORIES, EventCategory } from "@terramatch-microservices/database/constants/product-events";
import { Notification } from "@terramatch-microservices/database/entities";
import { populateDto } from "./json-api-attributes";

// This DTO should be kept to the minimum required to populate rows on the event center in the FE
@JsonApiDto({ type: "notifications" })
export class NotificationDto {
  constructor(notification: Notification) {
    populateDto<NotificationDto, Notification>(this, notification, {});
  }

  @ApiProperty()
  uuid: string;

  @ApiProperty({ type: String, required: false, nullable: true })
  projectUuid?: string | null;

  @ApiProperty({ type: String, required: false, nullable: true })
  projectName?: string | null;

  @ApiProperty({ type: String, nullable: true })
  summary: string | null;

  @ApiProperty({ enum: EVENT_CATEGORIES })
  category: EventCategory;

  @ApiProperty()
  unread: boolean;

  @ApiProperty()
  createdAt: Date;
}

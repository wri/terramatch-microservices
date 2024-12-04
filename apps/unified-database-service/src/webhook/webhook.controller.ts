import { BadRequestException, Controller, Get, Query } from "@nestjs/common";
import { AirtableService, EntityType } from "../airtable/airtable.service";
import { NoBearerAuth } from "@terramatch-microservices/common/guards";

@Controller("unified-database/v3/webhook")
export class WebhookController {
  constructor(private readonly airtableService: AirtableService) {}

  @Get()
  @NoBearerAuth
  // TODO (NJC): Documentation if we end up keeping this webhook.
  async triggerWebhook(@Query("entityType") entityType: EntityType, @Query("entityUuid") entityUuid: string) {
    if (entityType == null || entityUuid == null) {
      throw new BadRequestException("Missing query params");
    }

    if (!["project"].includes(entityType)) {
      throw new BadRequestException("entityType invalid");
    }

    await this.airtableService.updateAirtableJob(entityType, entityUuid);

    return { status: "OK" };
  }
}

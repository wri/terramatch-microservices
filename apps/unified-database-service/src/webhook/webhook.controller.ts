import { BadRequestException, Controller, Get, Query } from "@nestjs/common";
import { AirtableService, ENTITY_TYPES, EntityType } from "../airtable/airtable.service";
import { NoBearerAuth } from "@terramatch-microservices/common/guards";

@Controller("unified-database/v3/webhook")
export class WebhookController {
  constructor(private readonly airtableService: AirtableService) {}

  @Get()
  @NoBearerAuth
  // TODO (NJC): Documentation if we end up keeping this webhook.
  async triggerWebhook(@Query("entityType") entityType: EntityType) {
    if (entityType == null) {
      throw new BadRequestException("Missing query params");
    }

    if (!ENTITY_TYPES.includes(entityType)) {
      throw new BadRequestException("entityType invalid");
    }

    await this.airtableService.updateAirtableJob(entityType);

    return { status: "OK" };
  }
}

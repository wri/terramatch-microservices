import { BadRequestException, Controller, Get, Query } from "@nestjs/common";
import { AirtableService } from "../airtable/airtable.service";
import { NoBearerAuth } from "@terramatch-microservices/common/guards";
import { AIRTABLE_ENTITIES, EntityType } from "../airtable/airtable.processor";

@Controller("unified-database/v3/webhook")
export class WebhookController {
  constructor(private readonly airtableService: AirtableService) {}

  @Get()
  @NoBearerAuth
  // TODO (NJC): Documentation if we end up keeping this webhook.
  async triggerWebhook(@Query("entityType") entityType: EntityType, @Query("startPage") startPage?: number) {
    if (entityType == null) {
      throw new BadRequestException("Missing query params");
    }

    if (!Object.keys(AIRTABLE_ENTITIES).includes(entityType)) {
      throw new BadRequestException("entityType invalid");
    }

    await this.airtableService.updateAirtableJob(entityType, startPage);

    return { status: "OK" };
  }
}

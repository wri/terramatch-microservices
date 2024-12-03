import { Controller, Get } from "@nestjs/common";
import { AirtableService } from "../airtable/airtable.service";
import { NoBearerAuth } from "@terramatch-microservices/common/guards";

@Controller("unified-database/v3/webhook")
export class WebhookController {
  constructor(private readonly airtableService: AirtableService) {}

  @Get()
  @NoBearerAuth
  // TODO (NJC): Documentation if we end up keeping this webhook.
  async triggerWebhook() {
    await this.airtableService.updateAirtableJob();

    return { status: "OK" };
  }
}

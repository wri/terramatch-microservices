import { Module } from "@nestjs/common";
import { HealthModule } from "./health/health.module";
import { WebhookController } from "./webhook/webhook.controller";
import { AirtableModule } from "./airtable/airtable.module";

@Module({
  imports: [HealthModule, AirtableModule],
  controllers: [WebhookController]
})
export class AppModule {}

import { Module } from "@nestjs/common";
import { HealthModule } from "./health/health.module";
import { WebhookController } from "./webhook/webhook.controller";
import { AirtableModule } from "./airtable/airtable.module";
import { SentryGlobalFilter, SentryModule } from "@sentry/nestjs/setup";
import { DatabaseModule } from "@terramatch-microservices/database";
import { APP_FILTER } from "@nestjs/core";

@Module({
  imports: [SentryModule.forRoot(), DatabaseModule, HealthModule, AirtableModule],
  controllers: [WebhookController],
  providers: [
    {
      provide: APP_FILTER,
      useClass: SentryGlobalFilter
    }
  ]
})
export class AppModule {}

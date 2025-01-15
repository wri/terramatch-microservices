import { Module } from "@nestjs/common";
import { HealthModule } from "./health/health.module";
import { WebhookController } from "./webhook/webhook.controller";
import { AirtableModule } from "./airtable/airtable.module";
import { SentryGlobalFilter, SentryModule } from "@sentry/nestjs/setup";
import { DatabaseModule } from "@terramatch-microservices/database";
import { APP_FILTER } from "@nestjs/core";
import { ScheduleModule } from "@nestjs/schedule";

@Module({
  imports: [SentryModule.forRoot(), ScheduleModule.forRoot(), DatabaseModule, HealthModule, AirtableModule],
  controllers: [WebhookController],
  providers: [
    {
      provide: APP_FILTER,
      useClass: SentryGlobalFilter
    }
  ]
})
export class AppModule {}

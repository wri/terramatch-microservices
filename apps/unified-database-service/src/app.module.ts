import { Module } from "@nestjs/common";
import { WebhookController } from "./webhook/webhook.controller";
import { AirtableModule } from "./airtable/airtable.module";
import { SentryGlobalFilter, SentryModule } from "@sentry/nestjs/setup";
import { APP_FILTER } from "@nestjs/core";
import { ScheduleModule } from "@nestjs/schedule";
import { CommonModule } from "@terramatch-microservices/common";
import { HealthModule } from "@terramatch-microservices/common/health/health.module";

@Module({
  imports: [
    SentryModule.forRoot(),
    ...(process.env.REPL === "true" ? [] : [ScheduleModule.forRoot()]),
    CommonModule,
    HealthModule.configure({ additionalQueues: ["airtable"] }),
    AirtableModule
  ],
  controllers: [WebhookController],
  providers: [{ provide: APP_FILTER, useClass: SentryGlobalFilter }]
})
export class AppModule {}

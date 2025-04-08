import { CommonModule } from "@terramatch-microservices/common";
import { ConfigModule } from "@nestjs/config";
import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import { AirtableService } from "./airtable.service";
import { AirtableProcessor } from "./airtable.processor";
import { QueueHealthIndicator } from "./queue-health.indicator";
import { TerminusModule } from "@nestjs/terminus";

@Module({
  imports: [
    CommonModule,
    ConfigModule.forRoot({ isGlobal: true }),
    BullModule.registerQueue({ name: "airtable" }),
    TerminusModule
  ],
  providers: [AirtableService, AirtableProcessor, QueueHealthIndicator],
  exports: [AirtableService, QueueHealthIndicator]
})
export class AirtableModule {}

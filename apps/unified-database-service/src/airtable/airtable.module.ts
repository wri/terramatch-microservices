import { CommonModule } from "@terramatch-microservices/common";
import { ConfigModule } from "@nestjs/config";
import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import { AirtableService } from "./airtable.service";
import { AirtableProcessor } from "./airtable.processor";

@Module({
  imports: [CommonModule, ConfigModule.forRoot({ isGlobal: true }), BullModule.registerQueue({ name: "airtable" })],
  providers: [AirtableService, AirtableProcessor],
  exports: [AirtableService]
})
export class AirtableModule {}

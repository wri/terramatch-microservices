import { Module } from "@nestjs/common";
import { TerminusModule } from "@nestjs/terminus";
import { HealthController } from "./health.controller";
import { AirtableModule } from "../airtable/airtable.module";

@Module({
  imports: [TerminusModule, AirtableModule],
  controllers: [HealthController]
})
export class HealthModule {}

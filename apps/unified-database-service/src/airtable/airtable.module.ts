import { CommonModule } from "@terramatch-microservices/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
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
    BullModule.forRootAsync({
      imports: [ConfigModule.forRoot({ isGlobal: true })],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        connection: {
          host: configService.get("REDIS_HOST"),
          port: configService.get("REDIS_PORT"),
          prefix: "unified-database-service",
          // Use TLS in AWS
          ...(process.env.NODE_ENV !== "development" ? { tls: {} } : null)
        }
      })
    }),
    BullModule.registerQueue({ name: "airtable" }),
    TerminusModule
  ],
  providers: [AirtableService, AirtableProcessor, QueueHealthIndicator],
  exports: [AirtableService, QueueHealthIndicator]
})
export class AirtableModule {}

import { DatabaseModule } from "@terramatch-microservices/database";
import { CommonModule } from "@terramatch-microservices/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import { AirtableService } from "./airtable.service";
import { AirtableProcessor } from "./airtable.processor";
import { QueueHealthService } from "./queue-health.service";
import { SlackModule } from "nestjs-slack";

@Module({
  imports: [
    DatabaseModule,
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
    SlackModule.forRootAsync({
      imports: [ConfigModule.forRoot({ isGlobal: true })],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: "api",
        token: configService.get("SLACK_API_KEY")
      })
    })
  ],
  providers: [AirtableService, AirtableProcessor, QueueHealthService],
  exports: [AirtableService, QueueHealthService]
})
export class AirtableModule {}

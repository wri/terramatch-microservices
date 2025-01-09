import { DatabaseModule } from "@terramatch-microservices/database";
import { CommonModule } from "@terramatch-microservices/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import { AirtableService } from "./airtable.service";
import { AirtableProcessor } from "./airtable.processor";

@Module({
  imports: [
    DatabaseModule,
    CommonModule,
    ConfigModule.forRoot(),
    BullModule.forRootAsync({
      imports: [ConfigModule],
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
    BullModule.registerQueue({ name: "airtable" })
  ],
  providers: [AirtableService, AirtableProcessor],
  exports: [AirtableService]
})
export class AirtableModule {}

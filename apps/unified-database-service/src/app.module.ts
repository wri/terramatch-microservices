import { Module } from "@nestjs/common";
import { DatabaseModule } from "@terramatch-microservices/database";
import { CommonModule } from "@terramatch-microservices/common";
import { HealthModule } from "./health/health.module";
import { BullModule } from "@nestjs/bullmq";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { WebhookController } from "./webhook/webhook.controller";
import { AirtableService } from "./airtable/airtable.service";
import { AirtableProcessor } from "./airtable/airtable.processor";

@Module({
  imports: [
    DatabaseModule,
    CommonModule,
    HealthModule,
    ConfigModule.forRoot(),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        connection: {
          host: configService.get("REDIS_HOST"),
          port: configService.get("REDIS_PORT"),
          prefix: "unified-database-service"
        }
      })
    }),
    BullModule.registerQueue({ name: "airtable" })
  ],
  controllers: [WebhookController],
  providers: [AirtableService, AirtableProcessor]
})
export class AppModule {}

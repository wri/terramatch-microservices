import { Module } from "@nestjs/common";
import { RequestContextModule } from "nestjs-request-context";
import { APP_GUARD } from "@nestjs/core";
import { AuthGuard } from "./guards";
import { JwtModule } from "@nestjs/jwt";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { PolicyService } from "./policies/policy.service";
import { LocalizationService } from "./localization/localization.service";
import { EmailService } from "./email/email.service";
import { MediaService } from "./media/media.service";
import { TemplateService } from "./email/template.service";
import { SlackService } from "./slack/slack.service";
import { DatabaseModule } from "@terramatch-microservices/database";
import { EventEmitterModule } from "@nestjs/event-emitter";
import { EventService } from "./events/event.service";
import { BullModule } from "@nestjs/bullmq";
import { EmailProcessor } from "./email/email.processor";

export const QUEUES = ["email"];

@Module({
  imports: [
    RequestContextModule,
    JwtModule.registerAsync({
      imports: [ConfigModule.forRoot({ isGlobal: true })],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>("JWT_SECRET")
      })
    }),
    ConfigModule.forRoot({
      isGlobal: true
    }),
    DatabaseModule,
    // Event Emitter is used for sending lightweight messages about events typically from the DB
    // layer to processes that want to hear about specific types of DB updates.
    EventEmitterModule.forRoot(),
    // BullMQ is used for scheduling tasks that should not happen in the context of a typical API
    // request (like sending en email).
    BullModule.forRootAsync({
      imports: [ConfigModule.forRoot({ isGlobal: true })],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        connection: {
          host: configService.get("REDIS_HOST"),
          port: configService.get("REDIS_PORT"),
          prefix: "terramatch-microservices",
          // Use TLS in AWS
          ...(process.env["NODE_ENV"] !== "development" ? { tls: {} } : null)
        }
      })
    }),
    ...QUEUES.map(name => BullModule.registerQueue({ name }))
  ],
  providers: [
    PolicyService,
    { provide: APP_GUARD, useClass: AuthGuard },
    EmailService,
    LocalizationService,
    MediaService,
    TemplateService,
    SlackService,
    EventService,
    EmailProcessor
  ],
  exports: [PolicyService, JwtModule, EmailService, LocalizationService, MediaService, TemplateService, SlackService]
})
export class CommonModule {}

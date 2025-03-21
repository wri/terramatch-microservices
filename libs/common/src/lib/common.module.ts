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
    })
  ],
  providers: [
    PolicyService,
    { provide: APP_GUARD, useClass: AuthGuard },
    EmailService,
    LocalizationService,
    MediaService,
    TemplateService,
    SlackService
  ],
  exports: [PolicyService, JwtModule, EmailService, LocalizationService, MediaService, TemplateService, SlackService]
})
export class CommonModule {}

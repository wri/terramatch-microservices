import { Module } from '@nestjs/common';
import { RequestContextModule } from 'nestjs-request-context';
import { APP_GUARD } from '@nestjs/core';
import { AuthGuard } from './guards';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PolicyService } from './policies/policy.service';
import { TMLogService } from './util/tm-log.service';
import { LocalizationService } from "@terramatch-microservices/common/localization/localization.service";
import { TranslationService } from "@terramatch-microservices/common/localization/translation.service";
import { EmailService } from "@terramatch-microservices/common/email/email.service";

@Module({
  imports: [
    RequestContextModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
      }),
    }),
  ],
  providers: [
    PolicyService,
    { provide: APP_GUARD, useClass: AuthGuard },
    TMLogService,
    EmailService,
    LocalizationService,
    TranslationService,
  ],
  exports: [PolicyService, JwtModule, TMLogService, EmailService, LocalizationService, TranslationService],
})
export class CommonModule {}

import { Module } from "@nestjs/common";
import { LoginController } from "./auth/login.controller";
import { AuthService } from "./auth/auth.service";
import { DatabaseModule } from "@terramatch-microservices/database";
import { UsersController } from "./users/users.controller";
import { CommonModule } from "@terramatch-microservices/common";
import { HealthModule } from "./health/health.module";
import { SentryGlobalFilter, SentryModule } from "@sentry/nestjs/setup";
import { APP_FILTER } from "@nestjs/core";
import { EmailModule } from "./email/email.module";
import { ResetPasswordController } from "./auth/reset-password.controller";
import { ResetPasswordService } from "./auth/reset-password.service";
import { ConfigModule } from "@nestjs/config";

@Module({
  imports: [
    SentryModule.forRoot(),
    DatabaseModule,
    CommonModule,
    HealthModule,
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    EmailModule
  ],
  controllers: [LoginController, UsersController, ResetPasswordController],
  providers: [
    {
      provide: APP_FILTER,
      useClass: SentryGlobalFilter
    },
    AuthService,
    ResetPasswordService,
  ]
})
export class AppModule {}

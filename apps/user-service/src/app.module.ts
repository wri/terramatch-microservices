import { Module } from "@nestjs/common";
import { LoginController } from "./auth/login.controller";
import { AuthService } from "./auth/auth.service";
import { UsersController } from "./users/users.controller";
import { CommonModule } from "@terramatch-microservices/common";
import { SentryGlobalFilter, SentryModule } from "@sentry/nestjs/setup";
import { APP_FILTER } from "@nestjs/core";
import { ResetPasswordController } from "./auth/reset-password.controller";
import { ResetPasswordService } from "./auth/reset-password.service";
import { VerificationUserController } from "./auth/verification-user.controller";
import { VerificationUserService } from "./auth/verification-user.service";
import { UserCreationService } from "./users/user-creation.service";
import { HealthModule } from "@terramatch-microservices/common/health/health.module";

@Module({
  imports: [SentryModule.forRoot(), CommonModule, HealthModule],
  controllers: [LoginController, UsersController, ResetPasswordController, VerificationUserController],
  providers: [
    {
      provide: APP_FILTER,
      useClass: SentryGlobalFilter
    },
    AuthService,
    ResetPasswordService,
    VerificationUserService,
    UserCreationService
  ]
})
export class AppModule {}

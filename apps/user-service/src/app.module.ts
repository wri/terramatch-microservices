import { Module } from "@nestjs/common";
import { LoginController } from "./auth/login.controller";
import { AuthService } from "./auth/auth.service";
import { UsersController } from "./users/users.controller";
import { CommonModule } from "@terramatch-microservices/common";
import { SentryModule } from "@sentry/nestjs/setup";
import { APP_FILTER } from "@nestjs/core";
import { ResetPasswordController } from "./auth/reset-password.controller";
import { ResetPasswordService } from "./auth/reset-password.service";
import { VerificationUserController } from "./auth/verification-user.controller";
import { VerificationUserService } from "./auth/verification-user.service";
import { UserCreationService } from "./users/user-creation.service";
import { HealthModule } from "@terramatch-microservices/common/health/health.module";
import { OrganisationCreationService } from "./organisations/organisation-creation.service";
import { OrganisationsController } from "./organisations/organisations.controller";
import { BullModule } from "@nestjs/bullmq";
import { TMGlobalFilter } from "@terramatch-microservices/common/util/tm-global-filter";

@Module({
  imports: [
    SentryModule.forRoot(),
    CommonModule,
    HealthModule,
    CommonModule,
    BullModule.registerQueue({ name: "email" })
  ],
  controllers: [
    LoginController,
    ResetPasswordController,
    VerificationUserController,
    OrganisationsController,
    UsersController
  ],
  providers: [
    { provide: APP_FILTER, useClass: TMGlobalFilter },
    AuthService,
    ResetPasswordService,
    VerificationUserService,
    UserCreationService,
    OrganisationCreationService
  ]
})
export class AppModule {}

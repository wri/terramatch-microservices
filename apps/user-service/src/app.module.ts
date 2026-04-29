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
import { UsersService } from "./users/users.service";
import { HealthModule } from "@terramatch-microservices/common/health/health.module";
import { OrganisationsController } from "./organisations/organisations.controller";
import { OrganisationsService } from "./organisations/organisations.service";
import { OrganisationCreationService } from "./organisations/organisation-creation.service";
import { ActionsController } from "./actions/actions.controller";
import { ActionsService } from "./actions/actions.service";
import { BullModule } from "@nestjs/bullmq";
import { TMGlobalFilter } from "@terramatch-microservices/common/util/tm-global-filter";
import { UserAssociationController } from "./user-association/user-association.controller";
import { UserAssociationService } from "./user-association/user-association.service";
import { USER_SERVICE_EXPORT_QUEUE, UserServiceExportsProcessor } from "./exports/user-service-exports.processor";
import { ConfigModule, ConfigService } from "@nestjs/config";

const IS_REPL = process.env["REPL"] === "true";

@Module({
  imports: [
    SentryModule.forRoot(),
    CommonModule,
    HealthModule,
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        connection: {
          host: configService.get("REDIS_HOST"),
          port: configService.get("REDIS_PORT")
        }
      })
    }),
    BullModule.registerQueue({ name: "email" }),
    BullModule.registerQueue({ name: USER_SERVICE_EXPORT_QUEUE })
  ],
  controllers: [
    LoginController,
    ResetPasswordController,
    VerificationUserController,
    OrganisationsController,
    ActionsController,
    UsersController,
    UserAssociationController
  ],
  providers: [
    { provide: APP_FILTER, useClass: TMGlobalFilter },
    AuthService,
    ResetPasswordService,
    VerificationUserService,
    UserCreationService,
    UsersService,
    OrganisationsService,
    OrganisationCreationService,
    ActionsService,
    UserAssociationService,

    ...(IS_REPL ? [] : [UserServiceExportsProcessor])
  ]
})
export class AppModule {}

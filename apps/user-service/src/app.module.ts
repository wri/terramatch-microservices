import { Module } from "@nestjs/common";
import { LoginController } from "./auth/login.controller";
import { AuthService } from "./auth/auth.service";
import { DatabaseModule } from "@terramatch-microservices/database";
import { UsersController } from "./users/users.controller";
import { CommonModule } from "@terramatch-microservices/common";
import { HealthModule } from "./health/health.module";
import { SentryGlobalFilter, SentryModule } from "@sentry/nestjs/setup";
import { APP_FILTER } from "@nestjs/core";

@Module({
  imports: [SentryModule.forRoot(), DatabaseModule, CommonModule, HealthModule],
  controllers: [LoginController, UsersController],
  providers: [
    {
      provide: APP_FILTER,
      useClass: SentryGlobalFilter
    },
    AuthService
  ]
})
export class AppModule {}

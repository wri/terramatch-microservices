import { Module } from '@nestjs/common';
import { LoginController } from './auth/login.controller';
import { AuthService } from './auth/auth.service';
import { DatabaseModule } from '@terramatch-microservices/database';
import { UsersController } from './users/users.controller';
import { CommonModule } from '@terramatch-microservices/common';
import { HealthModule } from './health/health.module';

@Module({
  imports: [DatabaseModule, CommonModule, HealthModule],
  controllers: [LoginController, UsersController],
  providers: [AuthService],
})
export class AppModule {}

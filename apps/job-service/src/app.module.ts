import { Module } from '@nestjs/common';
import { DatabaseModule } from '@terramatch-microservices/database';
import { CommonModule } from '@terramatch-microservices/common';
import { DelayedJobsController } from './jobs/delayed-jobs.controller';
import { HealthModule } from './health/health.module';

@Module({
  imports: [DatabaseModule, CommonModule, HealthModule],
  controllers: [DelayedJobsController],
  providers: [],
})
export class AppModule {}

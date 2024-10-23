import { Module } from '@nestjs/common';
import { DatabaseModule } from '@terramatch-microservices/database';
import { CommonModule } from '@terramatch-microservices/common';
import { JobsController } from './jobs/jobs.controller';
import { HealthModule } from './health/health.module';

@Module({
  imports: [DatabaseModule, CommonModule, HealthModule],
  controllers: [JobsController],
  providers: [],
})
export class AppModule {}

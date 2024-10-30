import { Module } from '@nestjs/common';
import { DatabaseModule } from '@terramatch-microservices/database';
import { CommonModule } from '@terramatch-microservices/common';
import { HealthModule } from './health/health.module';
import { SitePolygonsController } from './site-polygons/site-polygons.controller';

@Module({
  imports: [DatabaseModule, CommonModule, HealthModule],
  controllers: [SitePolygonsController],
  providers: [],
})
export class AppModule {}

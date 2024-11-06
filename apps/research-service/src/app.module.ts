import { Module } from '@nestjs/common';
import { DatabaseModule } from '@terramatch-microservices/database';
import { CommonModule } from '@terramatch-microservices/common';
import { HealthModule } from './health/health.module';
import { SitePolygonsController } from './site-polygons/site-polygons.controller';
import { SitePolygonsService } from './site-polygons/site-polygons.service';

@Module({
  imports: [DatabaseModule, CommonModule, HealthModule],
  controllers: [SitePolygonsController],
  providers: [SitePolygonsService],
})
export class AppModule {}

import { Module } from "@nestjs/common";
import { DatabaseModule } from "@terramatch-microservices/database";
import { CommonModule } from "@terramatch-microservices/common";
import { HealthModule } from "./health/health.module";
import { SitePolygonsController } from "./site-polygons/site-polygons.controller";
import { SitePolygonsService } from "./site-polygons/site-polygons.service";
import { APP_FILTER } from "@nestjs/core";
import { SentryGlobalFilter, SentryModule } from "@sentry/nestjs/setup";

@Module({
  imports: [SentryModule.forRoot(), DatabaseModule, CommonModule, HealthModule],
  controllers: [SitePolygonsController],
  providers: [
    {
      provide: APP_FILTER,
      useClass: SentryGlobalFilter
    },
    SitePolygonsService
  ]
})
export class AppModule {}

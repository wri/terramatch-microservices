import { Module } from "@nestjs/common";
import { CommonModule } from "@terramatch-microservices/common";
import { SitePolygonsController } from "./site-polygons/site-polygons.controller";
import { SitePolygonsService } from "./site-polygons/site-polygons.service";
import { APP_FILTER } from "@nestjs/core";
import { SentryGlobalFilter, SentryModule } from "@sentry/nestjs/setup";
import { HealthModule } from "@terramatch-microservices/common/health/health.module";

@Module({
  imports: [SentryModule.forRoot(), CommonModule, HealthModule],
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

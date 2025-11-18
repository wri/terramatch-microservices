import { Module } from "@nestjs/common";
import { CommonModule } from "@terramatch-microservices/common";
import { SitePolygonsController } from "./site-polygons/site-polygons.controller";
import { SitePolygonsService } from "./site-polygons/site-polygons.service";
import { SitePolygonCreationService } from "./site-polygons/site-polygon-creation.service";
import { PolygonGeometryCreationService } from "./site-polygons/polygon-geometry-creation.service";
import { PointGeometryCreationService } from "./site-polygons/point-geometry-creation.service";
import { APP_FILTER } from "@nestjs/core";
import { SentryGlobalFilter, SentryModule } from "@sentry/nestjs/setup";
import { HealthModule } from "@terramatch-microservices/common/health/health.module";
import { BoundingBoxController } from "./bounding-boxes/bounding-box.controller";
import { BoundingBoxService } from "./bounding-boxes/bounding-box.service";
import { ValidationController } from "./validations/validation.controller";
import { ValidationService } from "./validations/validation.service";
import { ValidationProcessor } from "./validations/validation.processor";
import { DuplicateGeometryValidator } from "./validations/validators/duplicate-geometry.validator";
import { DataApiModule } from "@terramatch-microservices/data-api";
import { BullModule } from "@nestjs/bullmq";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { VoronoiService } from "./voronoi/voronoi.service";
import { PolygonClippingController } from "./polygon-clipping/polygon-clipping.controller";
import { PolygonClippingService } from "./polygon-clipping/polygon-clipping.service";
import { IndicatorsController } from "./indicators/indicators.controller";
import { IndicatorsService } from "./indicators/indicators.service";
import { IndicatorsProcessor } from "./indicators/indicators.processor";

@Module({
  imports: [
    SentryModule.forRoot(),
    CommonModule,
    HealthModule,
    DataApiModule,
    ConfigModule.forRoot({ isGlobal: true }),
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
    BullModule.registerQueue({ name: "validation" }),
    BullModule.registerQueue({ name: "indicators" })
  ],
  controllers: [
    SitePolygonsController,
    BoundingBoxController,
    ValidationController,
    PolygonClippingController,
    IndicatorsController
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: SentryGlobalFilter
    },
    IndicatorsService,
    SitePolygonsService,
    SitePolygonCreationService,
    PolygonGeometryCreationService,
    PointGeometryCreationService,
    BoundingBoxService,
    ValidationService,
    ValidationProcessor,
    IndicatorsProcessor,
    DuplicateGeometryValidator,
    VoronoiService,
    PolygonClippingService
  ]
})
export class AppModule {}

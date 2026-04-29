import { Module } from "@nestjs/common";
import { CommonModule } from "@terramatch-microservices/common";
import { SitePolygonsController } from "./site-polygons/site-polygons.controller";
import { SitePolygonsService } from "./site-polygons/site-polygons.service";
import { SitePolygonCreationService } from "./site-polygons/site-polygon-creation.service";
import { SitePolygonVersioningService } from "./site-polygons/site-polygon-versioning.service";
import { PolygonGeometryCreationService } from "./site-polygons/polygon-geometry-creation.service";
import { PointGeometryCreationService } from "./site-polygons/point-geometry-creation.service";
import { GeometryFileProcessingService } from "./site-polygons/geometry-file-processing.service";
import { APP_FILTER } from "@nestjs/core";
import { SentryModule } from "@sentry/nestjs/setup";
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
import { GeometryUploadProcessor } from "./site-polygons/geometry-upload.processor";
import { GeometryUploadComparisonService } from "./site-polygons/geometry-upload-comparison.service";
import { IndicatorsController } from "./indicators/indicators.controller";
import { IndicatorsService } from "./indicators/indicators.service";
import { IndicatorsProcessor } from "./indicators/indicators.processor";
import { ClippingProcessor } from "./polygon-clipping/polygon-clipping.processor";
import { GeoJsonExportService } from "./geojson-export/geojson-export.service";
import { TMGlobalFilter } from "@terramatch-microservices/common/util/tm-global-filter";
import { ProjectPolygonsController } from "./project-polygons/project-polygons.controller";
import { ProjectPolygonsService } from "./project-polygons/project-polygons.service";
import { ProjectPolygonCreationService } from "./project-polygons/project-polygon-creation.service";
import { ProjectPolygonGeometryService } from "./project-polygons/project-polygon-geometry.service";
import { AnrPlotGeometryController } from "./site-polygons/anr-plot-geometry.controller";
import { AnrPlotGeometryService } from "./site-polygons/anr-plot-geometry.service";

const IS_REPL = process.env["REPL"] === "true";

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
    BullModule.registerQueue({ name: "geometry-upload" }),
    BullModule.registerQueue({ name: "indicators" }),
    BullModule.registerQueue({ name: "clipping" }),
    BullModule.registerQueue({ name: "sitePolygons" }),
    BullModule.registerQueue({ name: "email" })
  ],
  controllers: [
    SitePolygonsController,
    BoundingBoxController,
    ValidationController,
    PolygonClippingController,
    IndicatorsController,
    ProjectPolygonsController,
    AnrPlotGeometryController
  ],
  providers: [
    { provide: APP_FILTER, useClass: TMGlobalFilter },
    IndicatorsService,
    SitePolygonsService,
    SitePolygonCreationService,
    SitePolygonVersioningService,
    PolygonGeometryCreationService,
    PointGeometryCreationService,
    GeometryFileProcessingService,
    GeometryUploadComparisonService,
    BoundingBoxService,
    ValidationService,
    DuplicateGeometryValidator,
    VoronoiService,
    PolygonClippingService,
    GeoJsonExportService,
    ProjectPolygonsService,
    ProjectPolygonCreationService,
    ProjectPolygonGeometryService,
    AnrPlotGeometryService,

    ...(IS_REPL ? [] : [ClippingProcessor, IndicatorsProcessor, ValidationProcessor, GeometryUploadProcessor])
  ]
})
export class AppModule {}

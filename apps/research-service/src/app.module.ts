import { Module } from "@nestjs/common";
import { CommonModule } from "@terramatch-microservices/common";
import { SitePolygonsController } from "./site-polygons/site-polygons.controller";
import { SitePolygonsService } from "./site-polygons/site-polygons.service";
import { APP_FILTER } from "@nestjs/core";
import { SentryGlobalFilter, SentryModule } from "@sentry/nestjs/setup";
import { HealthModule } from "@terramatch-microservices/common/health/health.module";
import { BoundingBoxController } from "./bounding-boxes/bounding-box.controller";
import { BoundingBoxService } from "./bounding-boxes/bounding-box.service";
import { ValidationController } from "./validations/validation.controller";
import { ValidationService } from "./validations/validation.service";
import { ValidationProcessor } from "./validations/validation.processor";
import { DataApiModule } from "@terramatch-microservices/data-api";
import { BullModule } from "@nestjs/bullmq";
import { ConfigModule, ConfigService } from "@nestjs/config";

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
    BullModule.registerQueue({ name: "validation" })
  ],
  controllers: [SitePolygonsController, BoundingBoxController, ValidationController],
  providers: [
    {
      provide: APP_FILTER,
      useClass: SentryGlobalFilter
    },
    SitePolygonsService,
    BoundingBoxService,
    ValidationService,
    ValidationProcessor
  ]
})
export class AppModule {}

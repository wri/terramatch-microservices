import "source-map-support/register";

// eslint-disable-next-line @nx/enforce-module-boundaries
import "../../../instrument-sentry";

import { AppModule } from "./app.module";
import { DocumentBuilder } from "@nestjs/swagger";
import bootstrapService, { HMRModule } from "@terramatch-microservices/common/util/bootstrap-service";

declare const module: HMRModule;

const bootstrap = bootstrapService(module, {
  module: AppModule,
  swaggerConfig: new DocumentBuilder()
    .setTitle("TerraMatch Unified Database Service")
    .setDescription("Service that updates the Unified Database Airtable instance")
    .setVersion("1.0")
    .addTag("unified-database-service")
    .build(),
  devPort: process.env.UNIFIED_DATABASE_SERVICE_PORT ?? 4040
});

bootstrap();

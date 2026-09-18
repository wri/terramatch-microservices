import "source-map-support/register";

// eslint-disable-next-line @nx/enforce-module-boundaries
import "../../../instrument-sentry";

import { DocumentBuilder } from "@nestjs/swagger";
import { AppModule } from "./app.module";
import bootstrapService, { HMRModule } from "@terramatch-microservices/common/util/bootstrap-service";

declare const module: HMRModule;

const bootstrap = bootstrapService(module, {
  module: AppModule,
  swaggerConfig: new DocumentBuilder()
    .setTitle("TerraMatch Job Service")
    .setDescription("APIs related to delayed jobs")
    .setVersion("1.0")
    .addTag("job-service")
    .build(),
  devPort: process.env.JOB_SERVICE_PORT ?? 4020
});

bootstrap();

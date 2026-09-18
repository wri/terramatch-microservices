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
    .setTitle("TerraMatch Research Service")
    .setDescription("APIs related to needs for the data research team.")
    .setVersion("1.0")
    .addTag("research-service")
    .build(),
  devPort: process.env.RESEARCH_SERVICE_PROXY_PORT ?? 4030
});

bootstrap();

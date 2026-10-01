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
    .setTitle("TerraMatch User Service")
    .setDescription("APIs related to login, users and organisations.")
    .setVersion("1.0")
    .addTag("user-service")
    .build(),
  devPort: process.env.USER_SERVICE_PORT ?? 4010
});

bootstrap();

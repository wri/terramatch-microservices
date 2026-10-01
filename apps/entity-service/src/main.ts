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
    .setTitle("TerraMatch Entity Service")
    .setDescription("APIs related to entities")
    .setVersion("1.0")
    .addTag("entity-service")
    .build(),
  devPort: process.env.ENTITY_SERVICE_PORT ?? 4050
});

bootstrap();

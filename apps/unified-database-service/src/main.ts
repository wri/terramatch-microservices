// eslint-disable-next-line @nx/enforce-module-boundaries
import "../../../instrument-sentry";

import { Logger, ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";

import { AppModule } from "./app.module";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { TMLogger } from "@terramatch-microservices/common/util/tm-logger";
import { NestExpressApplication } from "@nestjs/platform-express";

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: new TMLogger()
  });
  app.set("query parser", "extended");

  if (process.env.NODE_ENV === "development") {
    // CORS is handled by the Api Gateway in AWS
    app.enableCors();
  }

  const config = new DocumentBuilder()
    .setTitle("TerraMatch Unified Database Service")
    .setDescription("Service that updates the Unified Database Airtable instance")
    .setVersion("1.0")
    .addTag("unified-database-service")
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("unified-database-service/documentation/api", app, document);

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      transformOptions: { enableImplicitConversion: true, exposeDefaultValues: true }
    })
  );

  const port = process.env.NODE_ENV === "production" ? 80 : process.env.UNIFIED_DATABASE_SERVICE_PORT ?? 4040;
  await app.listen(port);

  Logger.log(`TerraMatch Unified Database Service is running on: http://localhost:${port}`);
}

bootstrap();

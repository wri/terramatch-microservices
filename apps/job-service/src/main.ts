// eslint-disable-next-line @nx/enforce-module-boundaries
import "../../../instrument-sentry";

import { Logger, ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";

import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { TMLogger } from "@terramatch-microservices/common/util/tm-logger";
import { AppModule } from "./app.module";
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
    .setTitle("TerraMatch Job Service")
    .setDescription("APIs related to delayed jobs")
    .setVersion("1.0")
    .addTag("job-service")
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("job-service/documentation/api", app, document);

  app.useGlobalPipes(new ValidationPipe({ transform: true, transformOptions: { enableImplicitConversion: true } }));

  const port = process.env.NODE_ENV === "production" ? 80 : process.env.JOB_SERVICE_PORT ?? 4020;
  await app.listen(port);

  Logger.log(`TerraMatch Job Service is running on: http://localhost:${port}`);
}

bootstrap();

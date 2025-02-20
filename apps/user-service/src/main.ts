// eslint-disable-next-line @nx/enforce-module-boundaries
import "../../../instrument-sentry";

import { Logger, ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";

import { AppModule } from "./app.module";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { TMLogService } from "@terramatch-microservices/common/util/tm-log.service";
import { NestExpressApplication } from "@nestjs/platform-express";

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.set("query parser", "extended");

  if (process.env.NODE_ENV === "development") {
    // CORS is handled by the Api Gateway in AWS
    app.enableCors();
  }

  const config = new DocumentBuilder()
    .setTitle("TerraMatch User Service")
    .setDescription("APIs related to login, users and organisations.")
    .setVersion("1.0")
    .addTag("user-service")
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("user-service/documentation/api", app, document);

  app.useGlobalPipes(new ValidationPipe({ transform: true, transformOptions: { enableImplicitConversion: true } }));
  app.useLogger(app.get(TMLogService));

  const port = process.env.NODE_ENV === "production" ? 80 : process.env.USER_SERVICE_PORT ?? 4010;
  await app.listen(port);

  Logger.log(`TerraMatch User Service is running on: http://localhost:${port}`);
}

bootstrap();

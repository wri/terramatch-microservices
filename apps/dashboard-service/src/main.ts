// eslint-disable-next-line @nx/enforce-module-boundaries
import "../../../instrument-sentry";

import { Logger, ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { TMLogger } from "@terramatch-microservices/common/util/tm-logger";
import { NestExpressApplication } from "@nestjs/platform-express";
import { DocumentBuilderInterceptor } from "@terramatch-microservices/common/util/document-builder-interceptor";

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
    .setTitle("TerraMatch Dashboard Service")
    .setDescription("APIs related to the TerraMatch Dashboard")
    .setVersion("1.0")
    .addTag("dashboard-service")
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("dashboard-service/documentation/api", app, document);

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      transformOptions: { enableImplicitConversion: true, exposeDefaultValues: true }
    })
  );

  app.useGlobalInterceptors(new DocumentBuilderInterceptor());

  const port = process.env.NODE_ENV === "production" ? 80 : process.env.DASHBOARD_SERVICE_PORT ?? 4060;
  await app.listen(port);

  Logger.log(`TerraMatch Dashboard Service is running on: http://localhost:${port}`);
}

bootstrap();

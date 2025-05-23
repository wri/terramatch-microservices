// eslint-disable-next-line @nx/enforce-module-boundaries
import "../../../instrument-sentry";

import { Logger, ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { TMLogger } from "@terramatch-microservices/common/util/tm-logger";
import { NestFastifyApplication } from "@nestjs/platform-fastify";
import { FastifyAdapter } from "@nestjs/platform-fastify";
import multipart from "@fastify/multipart";

async function bootstrap() {
  const adapter = new FastifyAdapter();

  await adapter.register(multipart);

  const app = await NestFactory.create<NestFastifyApplication>(AppModule, adapter, {
    logger: new TMLogger()
  });
  // TODO: register back this query parser
  // app.set("query parser", "extended");

  if (process.env.NODE_ENV === "development") {
    // CORS is handled by the Api Gateway in AWS
    app.enableCors();
  }

  const config = new DocumentBuilder()
    .setTitle("TerraMatch Entity Service")
    .setDescription("APIs related to entities")
    .setVersion("1.0")
    .addTag("entity-service")
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("entity-service/documentation/api", app, document);

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      transformOptions: { enableImplicitConversion: true, exposeDefaultValues: true }
    })
  );

  const port = process.env.NODE_ENV === "production" ? 80 : process.env.ENTITY_SERVICE_PORT ?? 4050;
  await app.listen(port);

  Logger.log(`TerraMatch Entity Service is running on: http://localhost:${port}`);
}

bootstrap();

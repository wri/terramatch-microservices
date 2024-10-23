import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { TMLogService } from '@terramatch-microservices/common/util/tm-log.service';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const config = new DocumentBuilder()
    .setTitle('TerraMatch Job Service')
    .setDescription('APIs related to delayed jobs')
    .setVersion('1.0')
    .addTag('job-service')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('job-service/documentation/api', app, document);

  app.useGlobalPipes(new ValidationPipe());
  app.useLogger(app.get(TMLogService));

  const port = process.env.NODE_ENV === 'production'
    ? 80
    : process.env.JOB_SERVICE_PROXY_PORT ?? 4020;
  await app.listen(port);

  Logger.log(`TerraMatch Job Service is running on: http://localhost:${port}`);
}

bootstrap();

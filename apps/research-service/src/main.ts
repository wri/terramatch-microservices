import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { TMLogService } from '@terramatch-microservices/common/util/tm-log.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const config = new DocumentBuilder()
    .setTitle('TerraMatch Research Service')
    .setDescription('APIs related to needs for the data research team.')
    .setVersion('1.0')
    .addTag('research-service')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('research-service/documentation/api', app, document);

  app.useGlobalPipes(new ValidationPipe());
  app.useLogger(app.get(TMLogService));

  const port = process.env.NODE_ENV === 'production'
    ? 80
    : process.env.RESEARCH_SERVICE_PROXY_PORT ?? 4030;
  await app.listen(port);

  Logger.log(`TerraMatch Research Service is running on: http://localhost:${port}`);
}

bootstrap();
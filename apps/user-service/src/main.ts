import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { TransformInterceptor } from '@terramatch-microservices/common/interceptors';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const config = new DocumentBuilder()
    .setTitle('TerraMatch User Service')
    .setDescription('APIs related to login, users and organisations.')
    .setVersion('1.0')
    .addTag('user-service')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('user-service/documentation/api', app, document);

  app.useGlobalPipes(new ValidationPipe());
  app.useGlobalInterceptors(new TransformInterceptor());

  const port = process.env.PORT ?? 4010;
  await app.listen(port);
  Logger.log(
    `User Service is running on: http://localhost:${port}`
  );
}

bootstrap();

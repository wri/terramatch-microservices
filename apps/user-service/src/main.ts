import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app/app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const globalPrefix = 'user-service';
  app.setGlobalPrefix(globalPrefix);
  const port = process.env.PORT ?? 4010;
  await app.listen(port);
  Logger.log(
    `User Service is running on: http://localhost:${port}/${globalPrefix}`
  );
}

bootstrap();

import { AuthGuard } from './auth.guard';
import { Test } from '@nestjs/testing';
import { APP_GUARD } from '@nestjs/core';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { JwtService } from '@nestjs/jwt';
import { Controller, Get, HttpStatus, INestApplication } from '@nestjs/common';
import * as request from 'supertest';

@Controller('test')
class TestController {
  @Get()
  test() {
    return 'test';
  }
}

describe('AuthGuard', () => {
  let jwtService: DeepMocked<JwtService>;
  let app: INestApplication;

  beforeEach(async () => {
    app = (await Test.createTestingModule({
      controllers: [TestController],
      providers: [
        { provide: JwtService, useValue: jwtService = createMock<JwtService>() },
        { provide: APP_GUARD, useClass: AuthGuard },
      ],
    }).compile()).createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('should return an error when no auth header is present', async () => {
    await request(app.getHttpServer())
      .get('/test')
      .expect(HttpStatus.UNAUTHORIZED);
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { UnauthorizedException } from '@nestjs/common';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: DeepMocked<AuthService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: authService = createMock<AuthService>() },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  })

  it('should throw if creds are invalid', async () => {
    authService.login.mockResolvedValue(null);

    await expect(() => controller.login({ emailAddress: 'foo@bar.com', password: 'asdfasdfasdf' }))
      .rejects
      .toThrow(UnauthorizedException)
  })

  it('returns a token if creds are valid', async () => {
    const token = 'fake jwt token';
    const userId = 123;
    authService.login.mockResolvedValue({ token, userId })

    const result = await controller.login({ emailAddress: 'foo@bar.com', password: 'asdfasdfasdf' });
    expect(result).toEqual({ type: 'logins', token, id: `${userId}` })
  })
});

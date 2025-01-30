import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { LocalizationKey, User } from "@terramatch-microservices/database/entities";
import { UserFactory } from '@terramatch-microservices/database/factories';
import { EmailService } from "@terramatch-microservices/common/email/email.service";
import { ResetPasswordService } from "./reset-password.service";
import { NotFoundException } from "@nestjs/common";
import { LocalizationKeyFactory } from "@terramatch-microservices/database/factories/localization-key.factory";

describe('ResetPasswordService', () => {
  let service: ResetPasswordService;
  let jwtService: DeepMocked<JwtService>;
  let emailService: DeepMocked<EmailService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ResetPasswordService,
        {
          provide: JwtService,
          useValue: (jwtService = createMock<JwtService>()),
        },
        {
          provide: EmailService,
          useValue: (emailService = createMock<EmailService>()),
        },
      ],
    }).compile();

    service = module.get<ResetPasswordService>(ResetPasswordService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should throw when user is not found', async () => {
    jest.spyOn(User, 'findOne').mockImplementation(() => Promise.resolve(null));
    await expect(service.sendResetPasswordEmail('user@gmail.com', 'https://example.com/auth/reset-password')).rejects.toThrow(NotFoundException);
  });

  it('should throw when localization key is not found', async () => {
    jest.spyOn(LocalizationKey, 'findOne').mockImplementation(() => Promise.resolve(null));
    await expect(service.sendResetPasswordEmail('user@gmail.com', 'https://example.com/auth/reset-password')).rejects.toThrow(NotFoundException);
  });

  it('should send a reset password email to the user', async () => {
    const user = await UserFactory.create();
    const localization = await LocalizationKeyFactory.create({ value: 'Reset your password by clicking on the following link: link' });
    jest.spyOn(User, 'findOne').mockImplementation(() => Promise.resolve(user));
    jest.spyOn(LocalizationKey, 'findOne').mockImplementation(() => Promise.resolve(localization));

    const token = 'fake jwt token';
    jwtService.signAsync.mockReturnValue(Promise.resolve(token));

    emailService.sendEmail.mockReturnValue(Promise.resolve());

    const result = await service.sendResetPasswordEmail('user@gmail.com', 'https://example.com/auth/reset-password');
    expect(jwtService.signAsync).toHaveBeenCalled()
    expect(emailService.sendEmail).toHaveBeenCalled();
    expect(result).toStrictEqual({ email: user.emailAddress, uuid: user.uuid, userId: user.id });
  });

});

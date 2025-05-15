import { Test, TestingModule } from "@nestjs/testing";
import { JwtService } from "@nestjs/jwt";
import { createMock, DeepMocked } from "@golevelup/ts-jest";
import { User } from "@terramatch-microservices/database/entities";
import { UserFactory } from "@terramatch-microservices/database/factories";
import { EmailService } from "@terramatch-microservices/common/email/email.service";
import { ResetPasswordService } from "./reset-password.service";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { LocalizationKeyFactory } from "@terramatch-microservices/database/factories/localization-key.factory";
import { LocalizationService } from "@terramatch-microservices/common/localization/localization.service";
import { TemplateService } from "@terramatch-microservices/common/templates/template.service";

describe("ResetPasswordService", () => {
  let service: ResetPasswordService;
  let jwtService: DeepMocked<JwtService>;
  let emailService: DeepMocked<EmailService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ResetPasswordService,
        {
          provide: JwtService,
          useValue: (jwtService = createMock<JwtService>())
        },
        {
          provide: EmailService,
          useValue: (emailService = createMock<EmailService>())
        },
        {
          provide: LocalizationService,
          useValue: createMock<LocalizationService>()
        },
        {
          provide: TemplateService,
          useValue: createMock<TemplateService>()
        }
      ]
    }).compile();

    service = module.get<ResetPasswordService>(ResetPasswordService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should throw when user is not found", async () => {
    jest.spyOn(User, "findOne").mockImplementation(() => Promise.resolve(null));
    await expect(
      service.sendResetPasswordEmail("user@gmail.com", "https://example.com/auth/reset-password")
    ).rejects.toThrow(NotFoundException);
  });

  it("should send a reset password email to the user", async () => {
    const user = await UserFactory.create();
    await LocalizationKeyFactory.create({
      key: "reset-password.body",
      value: "Reset your password by clicking on the following link: link"
    });
    await LocalizationKeyFactory.create({
      key: "reset-password.subject",
      value: "Reset Password"
    });
    await LocalizationKeyFactory.create({
      key: "reset-password.title",
      value: "Reset Password"
    });
    await LocalizationKeyFactory.create({
      key: "reset-password.cta",
      value: "Reset Password"
    });

    const token = "fake token";
    jwtService.signAsync.mockReturnValue(Promise.resolve(token));

    emailService.sendI18nTemplateEmail.mockReturnValue(Promise.resolve());

    const result = await service.sendResetPasswordEmail(user.emailAddress, "https://example.com/auth/reset-password");
    expect(jwtService.signAsync).toHaveBeenCalled();
    expect(emailService.sendI18nTemplateEmail).toHaveBeenCalled();
    expect(result).toStrictEqual({ email: user.emailAddress, uuid: user.uuid });
  });

  it("should an error when invalid token", async () => {
    const newPassword = "abc282821";
    // @ts-expect-error bogus mock value
    jwtService.verifyAsync.mockReturnValue(Promise.resolve(null));
    const token = "fake token";
    await expect(service.resetPassword(token, newPassword)).rejects.toThrow(
      new BadRequestException("Provided token is invalid or expired")
    );
  });

  it("should an error user not found", async () => {
    jest.spyOn(User, "findOne").mockImplementation(() => Promise.resolve(null));
    const newPassword = "abc282821";
    await expect(service.resetPassword("fake", newPassword)).rejects.toThrow(new NotFoundException("User not found"));
  });

  it("should reset password user", async () => {
    const user = await UserFactory.create();
    const newPassword = "abc282821";
    jest.spyOn(User, "findOne").mockImplementation(() => Promise.resolve(user));
    const token = await jwtService.signAsync({ sub: user.uuid }, { expiresIn: "2h" });
    const result = await service.resetPassword(token, newPassword);
    expect(jwtService.verifyAsync).toHaveBeenCalled();
    expect(result).toStrictEqual({ email: user.emailAddress, uuid: user.uuid });
  });
});

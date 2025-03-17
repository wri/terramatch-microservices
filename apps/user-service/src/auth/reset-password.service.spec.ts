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
import { TemplateService } from "@terramatch-microservices/common/email/template.service";

describe("ResetPasswordService", () => {
  let service: ResetPasswordService;
  let jwtService: DeepMocked<JwtService>;
  let emailService: DeepMocked<EmailService>;
  let localizationService: DeepMocked<LocalizationService>;
  let templateService: DeepMocked<TemplateService>;

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
          useValue: (localizationService = createMock<LocalizationService>())
        },
        {
          provide: TemplateService,
          useValue: (templateService = createMock<TemplateService>())
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

  it("should throw when localizations not found", async () => {
    const user = await UserFactory.create();
    jest.spyOn(User, "findOne").mockImplementation(() => Promise.resolve(user));
    localizationService.getLocalizationKeys.mockReturnValue(Promise.resolve([]));
    await expect(
      service.sendResetPasswordEmail("user@gmail.com", "https://example.com/auth/reset-password")
    ).rejects.toThrow(new NotFoundException("Localizations not found"));
  });

  it("should throw when localization body not found", async () => {
    const user = await UserFactory.create();
    jest.spyOn(User, "findOne").mockImplementation(() => Promise.resolve(user));
    const localizationSubject = await LocalizationKeyFactory.create({
      key: "reset-password.subject",
      value: "Reset Password"
    });
    localizationService.getLocalizationKeys.mockReturnValue(Promise.resolve([localizationSubject]));
    await expect(
      service.sendResetPasswordEmail("user@gmail.com", "https://example.com/auth/reset-password")
    ).rejects.toThrow(new NotFoundException("Localization body not found"));
  });

  it("should throw when localization title not found", async () => {
    const user = await UserFactory.create();
    jest.spyOn(User, "findOne").mockImplementation(() => Promise.resolve(user));
    const localizationSubject = await LocalizationKeyFactory.create({
      key: "reset-password.subject",
      value: "Reset Password"
    });
    const localizationBody = await LocalizationKeyFactory.create({
      key: "reset-password.body",
      value: "Reset your password by clicking on the following link: link"
    });
    localizationService.getLocalizationKeys.mockReturnValue(Promise.resolve([localizationSubject, localizationBody]));
    await expect(
      service.sendResetPasswordEmail("user@gmail.com", "https://example.com/auth/reset-password")
    ).rejects.toThrow(new NotFoundException("Localization title not found"));
  });

  it("should throw when localization CTA not found", async () => {
    const user = await UserFactory.create();
    jest.spyOn(User, "findOne").mockImplementation(() => Promise.resolve(user));
    const localizationSubject = await LocalizationKeyFactory.create({
      key: "reset-password.subject",
      value: "Reset Password"
    });
    const localizationBody = await LocalizationKeyFactory.create({
      key: "reset-password.body",
      value: "Reset your password by clicking on the following link: link"
    });
    const localizationTitle = await LocalizationKeyFactory.create({
      key: "reset-password.title",
      value: "Reset Password"
    });
    localizationService.getLocalizationKeys.mockReturnValue(
      Promise.resolve([localizationSubject, localizationBody, localizationTitle])
    );
    await expect(
      service.sendResetPasswordEmail("user@gmail.com", "https://example.com/auth/reset-password")
    ).rejects.toThrow(new NotFoundException("Localization CTA not found"));
  });

  it("should send a reset password email to the user", async () => {
    const user = await UserFactory.create();
    const localizationBody = await LocalizationKeyFactory.create({
      key: "reset-password.body",
      value: "Reset your password by clicking on the following link: link"
    });
    const localizationSubject = await LocalizationKeyFactory.create({
      key: "reset-password.subject",
      value: "Reset Password"
    });
    const localizationTitle = await LocalizationKeyFactory.create({
      key: "reset-password.title",
      value: "Reset Password"
    });
    const localizationCta = await LocalizationKeyFactory.create({
      key: "reset-password.cta",
      value: "Reset Password"
    });
    jest.spyOn(User, "findOne").mockImplementation(() => Promise.resolve(user));
    localizationService.getLocalizationKeys.mockReturnValue(
      Promise.resolve([localizationBody, localizationSubject, localizationTitle, localizationCta])
    );

    const token = "fake token";
    jwtService.signAsync.mockReturnValue(Promise.resolve(token));

    emailService.sendEmail.mockReturnValue(Promise.resolve());
    templateService.render.mockReturnValue("rendered template");

    const result = await service.sendResetPasswordEmail("user@gmail.com", "https://example.com/auth/reset-password");
    expect(jwtService.signAsync).toHaveBeenCalled();
    expect(emailService.sendEmail).toHaveBeenCalled();
    expect(result).toStrictEqual({ email: user.emailAddress, uuid: user.uuid });
  });

  it("should an error when invalid token", async () => {
    const newPassword = "abc282821";
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

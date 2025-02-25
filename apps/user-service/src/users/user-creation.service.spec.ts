import { Test, TestingModule } from "@nestjs/testing";
import { JwtService } from "@nestjs/jwt";
import { createMock, DeepMocked } from "@golevelup/ts-jest";
import { User } from "@terramatch-microservices/database/entities";
import { EmailService } from "@terramatch-microservices/common/email/email.service";
import { LocalizationService } from "@terramatch-microservices/common/localization/localization.service";
import { UserCreationService } from "./user-creation.service";
import { UserNewRequest } from "./dto/user-new-request.dto";
import { NotFoundException } from "@nestjs/common";
import { UserFactory } from "@terramatch-microservices/database/factories";
import { LocalizationKeyFactory } from "@terramatch-microservices/database/factories/localization-key.factory";
import { TemplateService } from "@terramatch-microservices/common/email/template.service";

describe("UserCreationService", () => {
  let service: UserCreationService;
  let jwtService: DeepMocked<JwtService>;
  let emailService: DeepMocked<EmailService>;
  let localizationService: DeepMocked<LocalizationService>;
  let templateService: DeepMocked<TemplateService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserCreationService,
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

    service = module.get<UserCreationService>(UserCreationService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should throw when user is not found", async () => {
    jest.spyOn(User, "findOne").mockImplementation(() => Promise.resolve(null));
    await expect(service.createNewUser(new UserNewRequest())).rejects.toThrow(NotFoundException);
  });

  it("should create a new user", async () => {
    const user = await UserFactory.create();
    const userNewRequest = new UserNewRequest();
    userNewRequest.emailAddress = user.emailAddress;
    userNewRequest.password = "secret";
    userNewRequest.firstName = "firstName";
    userNewRequest.lastName = "lastName";
    userNewRequest.role = "project-developer";
    userNewRequest.phoneNumber = "1234567890";
    userNewRequest.program = "";
    userNewRequest.callbackUrl = "https://localhost:3000";

    const localizationBody = await LocalizationKeyFactory.create({
      key: "user-verification.body",
      value: "Follow the below link to verify your email address."
    });
    const localizationSubject = await LocalizationKeyFactory.create({
      key: "user-verification.subject",
      value: "Verify Your Email Address"
    });

    const localizationTitle = await LocalizationKeyFactory.create({
      key: "user-verification.title",
      value: "VERIFY YOUR EMAIL ADDRESS"
    });

    const localizationCta = await LocalizationKeyFactory.create({
      key: "user-verification.cta",
      value: "VERIFY EMAIL ADDRESS"
    });

    localizationService.getLocalizationKeys.mockReturnValue(
      Promise.resolve([localizationBody, localizationSubject, localizationTitle, localizationCta])
    );

    const token = "fake token";
    jwtService.signAsync.mockReturnValue(Promise.resolve(token));
    emailService.sendEmail.mockReturnValue(Promise.resolve());
    templateService.render.mockReturnValue("rendered template");

    const result = await service.createNewUser(userNewRequest);
    expect(jwtService.signAsync).toHaveBeenCalled();
    expect(emailService.sendEmail).toHaveBeenCalled();
    expect(result).toBeDefined();
  });
});

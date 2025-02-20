import { Test, TestingModule } from "@nestjs/testing";
import { JwtService } from "@nestjs/jwt";
import { createMock, DeepMocked } from "@golevelup/ts-jest";
import { User } from "@terramatch-microservices/database/entities";
import { EmailService } from "@terramatch-microservices/common/email/email.service";
import { LocalizationService } from "@terramatch-microservices/common/localization/localization.service";
import { UserCreationService } from "./user-creation.service";
import { UserNewRequest } from "./dto/user-new-request.dto";
import { NotFoundException } from "@nestjs/common";

describe("UserCreationService", () => {
  let service: UserCreationService;
  let jwtService: DeepMocked<JwtService>;
  let emailService: DeepMocked<EmailService>;
  let localizationService: DeepMocked<LocalizationService>;

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
});

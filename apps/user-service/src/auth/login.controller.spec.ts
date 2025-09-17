import { Test, TestingModule } from "@nestjs/testing";
import { LoginController } from "./login.controller";
import { AuthService } from "./auth.service";
import { createMock, DeepMocked } from "@golevelup/ts-jest";
import { UnauthorizedException } from "@nestjs/common";
import { faker } from "@faker-js/faker";
import { serialize } from "@terramatch-microservices/common/util/testing";

describe("LoginController", () => {
  let controller: LoginController;
  let authService: DeepMocked<AuthService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [LoginController],
      providers: [{ provide: AuthService, useValue: (authService = createMock<AuthService>()) }]
    }).compile();

    controller = module.get<LoginController>(LoginController);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should throw if creds are invalid", async () => {
    authService.login.mockResolvedValue(null);

    await expect(
      controller.create({
        data: { type: "logins", attributes: { emailAddress: "foo@bar.com", password: "asdfasdfasdf" } }
      })
    ).rejects.toThrow(UnauthorizedException);
  });

  it("returns a token if creds are valid", async () => {
    const token = "fake jwt token";
    const userUuid = faker.string.uuid();
    authService.login.mockResolvedValue({ token, userUuid });

    const result = serialize(
      await controller.create({
        data: { type: "logins", attributes: { emailAddress: "foo@bar.com", password: "asdfasdfasdf" } }
      })
    );
    expect(result).toMatchObject({ data: { id: userUuid, type: "logins", attributes: { token } } });
  });
});

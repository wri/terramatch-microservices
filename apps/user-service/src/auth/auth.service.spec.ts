import { Test, TestingModule } from "@nestjs/testing";
import { AuthService } from "./auth.service";
import { JwtService } from "@nestjs/jwt";
import { createMock, DeepMocked } from "@golevelup/ts-jest";
import bcrypt from "bcryptjs";
import { User } from "@terramatch-microservices/database/entities";
import { UserFactory } from "@terramatch-microservices/database/factories";

describe("AuthService", () => {
  let service: AuthService;
  let jwtService: DeepMocked<JwtService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: JwtService,
          useValue: (jwtService = createMock<JwtService>())
        }
      ]
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should return null with invalid email", async () => {
    jest.spyOn(User, "findOne").mockImplementation(() => Promise.resolve(null));
    expect(await service.login("fake@foo.bar", "asdfasdfsadf")).toBeNull();
  });

  it("should return null with an invalid password", async () => {
    const { emailAddress } = await UserFactory.create({
      password: "fakepasswordhash"
    });
    expect(await service.login(emailAddress, "fakepassword")).toBeNull();
  });

  it("should return a token and id with a valid password", async () => {
    const { uuid, emailAddress } = await UserFactory.create({
      password: "fakepasswordhash"
    });
    jest.spyOn(bcrypt, "compare").mockImplementation(() => Promise.resolve(true));

    const token = "fake jwt token";
    jwtService.signAsync.mockReturnValue(Promise.resolve(token));

    const result = await service.login(emailAddress, "fakepassword");

    expect(jwtService.signAsync).toHaveBeenCalled();
    expect(result?.token).toBe(token);
    expect(result?.userUuid).toBe(uuid);
  });

  it("should update the last logged in date on the user", async () => {
    const user = await UserFactory.create({ password: "fakepasswordhash" });
    jest.spyOn(bcrypt, "compare").mockImplementation(() => Promise.resolve(true));
    jwtService.signAsync.mockResolvedValue("fake jwt token");

    await service.login(user.emailAddress, "fakepassword");

    const { lastLoggedInAt } = user;
    await user.reload();
    expect(lastLoggedInAt).not.toBe(user.lastLoggedInAt);
  });
});

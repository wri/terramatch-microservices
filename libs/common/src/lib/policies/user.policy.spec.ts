import { Test, TestingModule } from "@nestjs/testing";
import { PolicyService } from "./policy.service";
import { mockPermissions, mockUserId } from "./policy.service.spec";
import { User } from "@terramatch-microservices/database/entities";
import { UnauthorizedException } from "@nestjs/common";
import { UserFactory } from "@terramatch-microservices/database/factories";

describe("UserPolicy", () => {
  let service: PolicyService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PolicyService]
    }).compile();

    service = module.get<PolicyService>(PolicyService);
  });

  afterEach(async () => {
    jest.restoreAllMocks();
  });

  it("allows reading any user as admin", async () => {
    mockUserId(123);
    mockPermissions("users-manage");
    await expect(service.authorize("read", new User())).resolves.toBeUndefined();
  });

  it("disallows reading other users as non-admin", async () => {
    mockUserId(123);
    mockPermissions();
    await expect(service.authorize("read", new User())).rejects.toThrow(UnauthorizedException);
  });

  it("allows reading own user as non-admin", async () => {
    mockUserId(123);
    mockPermissions();
    await expect(service.authorize("read", await UserFactory.build({ id: 123 }))).resolves.toBeUndefined();
  });
});

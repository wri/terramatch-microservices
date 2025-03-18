import { Test } from "@nestjs/testing";
import { PolicyService } from "./policy.service";
import { expectCan, expectCannot, mockPermissions, mockUserId } from "./policy.service.spec";
import { User } from "@terramatch-microservices/database/entities";
import { UserFactory } from "@terramatch-microservices/database/factories";

describe("UserPolicy", () => {
  let service: PolicyService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [PolicyService]
    }).compile();

    service = await module.resolve(PolicyService);

    mockUserId(123);
  });

  afterEach(async () => {
    jest.restoreAllMocks();
  });

  it("allows reading any user as admin", async () => {
    mockPermissions("users-manage");
    await expectCan(service, "read", new User());
  });

  it("disallows reading other users as non-admin", async () => {
    mockPermissions();
    await expectCannot(service, "read", new User());
  });

  it("allows reading own user as non-admin", async () => {
    mockPermissions();
    await expectCan(service, "read", await UserFactory.build({ id: 123 }));
  });

  it("allows updating any user as admin", async () => {
    mockPermissions("users-manage");
    await expectCan(service, "update", new User());
  });

  it("disallows updating other users as non-admin", async () => {
    mockPermissions();
    await expectCannot(service, "update", new User());
  });

  it("allows updating own user as non-admin", async () => {
    mockPermissions();
    await expectCan(service, "update", await UserFactory.build({ id: 123 }));
  });
});

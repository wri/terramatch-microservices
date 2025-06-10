import { PolicyService } from "./policy.service";
import { Test } from "@nestjs/testing";
import { expectCan, expectCannot, mockPermissions, mockUserId } from "./policy.service.spec";
import { FormFactory, UserFactory } from "@terramatch-microservices/database/factories";
import { faker } from "@faker-js/faker";

describe("FormPolicy", () => {
  let service: PolicyService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [PolicyService]
    }).compile();

    service = await module.resolve(PolicyService);
  });

  afterEach(async () => {
    jest.restoreAllMocks();
  });

  it("should allow uploading files for forms updated by the user", async () => {
    const user = await UserFactory.create();
    mockUserId(user.id);
    mockPermissions();
    const form = await FormFactory.create({ updatedBy: user.uuid });
    await expectCan(service, ["uploadFiles"], form);
  });

  it("should disallow uploading files for forms not updated by the user", async () => {
    const user = await UserFactory.create();
    mockUserId(user.id);
    mockPermissions();
    const form = await FormFactory.create({ updatedBy: faker.string.uuid() }); // Different user
    await expectCannot(service, ["uploadFiles"], form);
  });

  it("should disallow managing forms without proper permissions", async () => {
    mockUserId(123);
    mockPermissions();
    const form = await FormFactory.create();
    await expectCannot(service, ["read", "create", "update", "delete"], form);
  });
});

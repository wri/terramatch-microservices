import { PolicyService } from "./policy.service";
import { Test } from "@nestjs/testing";
import { expectCan, expectCannot, mockPermissions, mockUserId } from "./policy.service.spec";
import { FormFactory, UserFactory } from "@terramatch-microservices/database/factories";

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

  it("should allow uploading files for forms in your framework", async () => {
    const user = await UserFactory.create();
    mockUserId(user.id);
    const frameworkKey = "ppc";
    mockPermissions(`framework-${frameworkKey}`);
    const form = await FormFactory.create({ frameworkKey });
    await expectCan(service, ["uploadFiles"], form);
  });
});

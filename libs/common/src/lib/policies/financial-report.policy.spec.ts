import { Test } from "@nestjs/testing";
import { PolicyService } from "./policy.service";
import { UserFactory } from "@terramatch-microservices/database/factories";
import { expectCan, mockPermissions, mockUserId } from "./policy.service.spec";
import { FinancialReport } from "@terramatch-microservices/database/entities";

describe("FinancialReportPolicy", () => {
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

  it("should allow read and delete for any user", async () => {
    const user = await UserFactory.create();
    mockUserId(user.id);
    mockPermissions();

    // Test with the class itself, not an instance
    await expectCan(service, "read", FinancialReport);
    await expectCan(service, "delete", FinancialReport);
  });
});

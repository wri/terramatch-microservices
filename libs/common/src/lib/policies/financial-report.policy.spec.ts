import { Test } from "@nestjs/testing";
import { PolicyService } from "./policy.service";
import { FinancialReportFactory, UserFactory } from "@terramatch-microservices/database/factories";
import { expectCan, mockPermissions, mockUserId } from "./policy.service.spec";

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

  it("should allow read and delete for financial reports for admins", async () => {
    const user = await UserFactory.create();
    mockUserId(user.id);
    mockPermissions("framework-admin");
    const financialReport = await FinancialReportFactory.create();
    await expectCan(service, ["read", "delete"], financialReport);
  });
});

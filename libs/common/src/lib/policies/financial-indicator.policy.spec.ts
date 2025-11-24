import { Test } from "@nestjs/testing";
import { PolicyService } from "./policy.service";
import { OrganisationFactory, UserFactory } from "@terramatch-microservices/database/factories";
import { expectAuthority, expectCan, expectCannot, mockPermissions, mockUserId } from "./policy.service.spec";
import { FinancialIndicatorFactory } from "@terramatch-microservices/database/factories/financial-indicator.factory";

describe("FinancialIndicatorPolicy", () => {
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

  it("should allow upload and delete files if user has organisationId", async () => {
    const org = await OrganisationFactory.create();
    const user = await UserFactory.create({ organisationId: org.id });
    mockUserId(user.id);
    mockPermissions();
    const financialIndicator = await FinancialIndicatorFactory.create({ organisationId: org.id });
    await expectCan(service, ["uploadFiles", "deleteFiles"], financialIndicator);
  });

  it("should allow managing all financial indicators with framework permissions", async () => {
    mockUserId(123);
    mockPermissions("framework-ppc");
    const fi1 = await FinancialIndicatorFactory.create();
    const fi2 = await FinancialIndicatorFactory.create();
    await expectAuthority(service, {
      can: [
        [["read", "delete", "update", "approve", "create", "deleteFiles", "uploadFiles"], fi1],
        [["read", "delete", "update", "approve", "create", "deleteFiles", "uploadFiles"], fi2]
      ]
    });
  });

  it("should not allow managing financial indicators without framework permissions", async () => {
    const org = await OrganisationFactory.create();
    const user = await UserFactory.create({ organisationId: org.id });
    mockUserId(user.id);
    mockPermissions("other-permission");
    const financialIndicator = await FinancialIndicatorFactory.create({ organisationId: org.id });
    await expectCannot(service, ["read", "delete", "update", "approve", "create"], financialIndicator);
    await expectCan(service, ["uploadFiles", "deleteFiles"], financialIndicator);
  });
});

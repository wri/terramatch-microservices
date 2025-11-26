import { Test } from "@nestjs/testing";
import { PolicyService } from "./policy.service";
import { OrganisationFactory, UserFactory } from "@terramatch-microservices/database/factories";
import { expectCan } from "./policy.service.spec";
import { FinancialIndicatorFactory } from "@terramatch-microservices/database/factories/financial-indicator.factory";
import { mockPermissions, mockUserId } from "../util/testing";

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

  it("should allow upload files if user is managing projects", async () => {
    const org = await OrganisationFactory.create();
    const user = await UserFactory.create({ organisationId: org.id });
    mockUserId(user.id);
    mockPermissions();
    const financialIndicator = await FinancialIndicatorFactory.create({ organisationId: org.id });
    await expectCan(service, "uploadFiles", financialIndicator);
  });
});

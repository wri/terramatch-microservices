import { PolicyService } from "./policy.service";
import { Test } from "@nestjs/testing";
import { expectAuthority, expectCan, expectCannot, mockPermissions, mockUserId } from "./policy.service.spec";
import { FinancialReport } from "@terramatch-microservices/database/entities";
import { OrganisationFactory, FinancialReportFactory, UserFactory } from "@terramatch-microservices/database/factories";

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

  it("allows managing financial reports in your framework", async () => {
    mockUserId(123);
    mockPermissions("framework-ppc");
    const ppc = await FinancialReportFactory.create({ frameworkKey: "ppc" });
    const tf = await FinancialReportFactory.create({ frameworkKey: "terrafund" });
    await expectAuthority(service, {
      can: [[["read", "delete", "update"], ppc]],
      cannot: [[["read", "delete", "update"], tf]]
    });
  });

  it("allows managing own financial reports", async () => {
    mockPermissions("manage-own");
    const org = await OrganisationFactory.create();
    const user = await UserFactory.create({ organisationId: org.id });
    mockUserId(user.id);

    const fr1 = await FinancialReportFactory.create({ organisationId: org.id });
    const fr2 = await FinancialReportFactory.create();
    await expectAuthority(service, {
      can: [[["read", "update", "delete"], fr1]],
      cannot: [[["read", "update", "delete"], fr2]]
    });
  });

  it("does not allow access without manage-own permission", async () => {
    const org = await OrganisationFactory.create();
    const user = await UserFactory.create({ organisationId: org.id });
    mockUserId(user.id);
    mockPermissions("other-permission");

    const financialReport = await FinancialReportFactory.create({ organisationId: org.id });
    await expectCannot(service, "read", financialReport);
    await expectCannot(service, "update", financialReport);
    await expectCannot(service, "delete", financialReport);
  });

  it("does not allow access for users without organisation", async () => {
    const user = await UserFactory.create({ organisationId: null });
    mockUserId(user.id);
    mockPermissions("manage-own");

    const financialReport = await FinancialReportFactory.create();
    await expectCannot(service, "read", financialReport);
    await expectCannot(service, "update", financialReport);
    await expectCannot(service, "delete", financialReport);
  });
});

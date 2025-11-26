import { PolicyService } from "./policy.service";
import { Test } from "@nestjs/testing";
import { expectAuthority, expectCannot } from "./policy.service.spec";
import { OrganisationFactory, FinancialReportFactory, UserFactory } from "@terramatch-microservices/database/factories";
import { mockPermissions, mockUserId } from "../util/testing";

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
      can: [[["read", "delete"], ppc]],
      cannot: [[["read", "delete"], tf]]
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
      can: [[["read", "delete"], fr1]],
      cannot: [[["read", "delete"], fr2]]
    });
  });

  it("allows managing all financial reports with reports-manage permission", async () => {
    mockUserId(123);
    mockPermissions("reports-manage");
    const fr1 = await FinancialReportFactory.create();
    const fr2 = await FinancialReportFactory.create();
    await expectAuthority(service, {
      can: [
        [["read", "delete"], fr1],
        [["read", "delete"], fr2]
      ]
    });
  });

  it("does not allow access without any permission", async () => {
    const org = await OrganisationFactory.create();
    const user = await UserFactory.create({ organisationId: org.id });
    mockUserId(user.id);
    mockPermissions("other-permission");

    const financialReport = await FinancialReportFactory.create({ organisationId: org.id });
    await expectCannot(service, "read", financialReport);
    await expectCannot(service, "delete", financialReport);
  });

  it("does not allow access for users without organisation", async () => {
    const user = await UserFactory.create({ organisationId: null });
    mockUserId(user.id);
    mockPermissions("manage-own");

    const financialReport = await FinancialReportFactory.create();
    await expectCannot(service, "read", financialReport);
    await expectCannot(service, "delete", financialReport);
  });
});

import { PolicyService } from "./policy.service";
import { Test } from "@nestjs/testing";
import { expectAuthority, expectCannot } from "./policy.service.spec";
import { FinancialReportFactory, OrganisationFactory, UserFactory } from "@terramatch-microservices/database/factories";
import { mockRequestContext, mockRequestForUser } from "../util/testing";

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
    mockRequestContext({ userId: 123, permissions: ["framework-ppc"] });
    const ppc = await FinancialReportFactory.org().create({ frameworkKey: "ppc" });
    const tf = await FinancialReportFactory.org().create({ frameworkKey: "terrafund" });
    await expectAuthority(service, {
      can: [[["read", "delete"], ppc]],
      cannot: [[["read", "delete"], tf]]
    });
  });

  it("allows managing own financial reports", async () => {
    const org = await OrganisationFactory.create();
    const user = await UserFactory.create({ organisationId: org.id });
    mockRequestForUser(user, "manage-own");

    const fr1 = await FinancialReportFactory.org(org).create();
    const fr2 = await FinancialReportFactory.org().create();
    await expectAuthority(service, {
      can: [[["read", "delete"], fr1]],
      cannot: [[["read", "delete"], fr2]]
    });
  });

  it("allows managing all financial reports with reports-manage permission", async () => {
    mockRequestContext({ userId: 123, permissions: ["reports-manage"] });
    const fr1 = await FinancialReportFactory.org().create();
    const fr2 = await FinancialReportFactory.org().create();
    await expectAuthority(service, {
      can: [
        [["read", "delete"], fr1],
        [["read", "delete"], fr2]
      ]
    });
  });

  it("does not allow access for users without organisation", async () => {
    const user = await UserFactory.create({ organisationId: null });
    mockRequestForUser(user, "manage-own");

    const financialReport = await FinancialReportFactory.org().create();
    await expectCannot(service, "read", financialReport);
    await expectCannot(service, "delete", financialReport);
  });
});

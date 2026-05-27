import { PolicyService } from "./policy.service";
import { Test } from "@nestjs/testing";
import { expectAuthority, expectCan, expectCannot } from "./policy.service.spec";
import {
  FinancialReportFactory,
  OrganisationFactory,
  ProjectFactory,
  ProjectUserFactory,
  RoleFactory,
  UserFactory
} from "@terramatch-microservices/database/factories";
import { mockUserContext, mockContextForUser } from "../util/testing";
import { AWAITING_APPROVAL, DUE, STARTED } from "@terramatch-microservices/database/constants/status";
import { ModelHasRole, User } from "@terramatch-microservices/database/entities";

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
    mockUserContext({ userId: 123, permissions: ["framework-ppc"] });
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
    mockContextForUser(user, "manage-own");

    const fr1 = await FinancialReportFactory.org(org).create();
    const fr2 = await FinancialReportFactory.org().create();
    await expectAuthority(service, {
      can: [[["read", "delete"], fr1]],
      cannot: [[["read", "delete"], fr2]]
    });
  });

  it("allows managing all financial reports with reports-manage permission", async () => {
    mockUserContext({ userId: 123, permissions: ["reports-manage"] });
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
    mockContextForUser(user, "manage-own");

    const financialReport = await FinancialReportFactory.org().create();
    await expectCannot(service, "read", financialReport);
    await expectCannot(service, "delete", financialReport);
  });

  it("allows updateAnswers for own organisation when status is started or due", async () => {
    const org = await OrganisationFactory.create();
    const user = await UserFactory.create({ organisationId: org.id });
    mockContextForUser(user, "manage-own");

    const started = await FinancialReportFactory.org(org).create({ status: STARTED });
    const due = await FinancialReportFactory.org(org).create({ status: DUE });
    await expectAuthority(service, {
      can: [
        ["updateAnswers", started],
        ["updateAnswers", due]
      ]
    });
  });

  it("allows updateAnswers when awaiting approval and nothingToReport is true", async () => {
    const org = await OrganisationFactory.create();
    const user = await UserFactory.create({ organisationId: org.id });
    mockContextForUser(user, "manage-own");

    const report = await FinancialReportFactory.org(org).create({
      status: AWAITING_APPROVAL,
      nothingToReport: true
    });
    await expectCan(service, "updateAnswers", report);
  });

  it("denies updateAnswers when awaiting approval without nothingToReport", async () => {
    const org = await OrganisationFactory.create();
    const user = await UserFactory.create({ organisationId: org.id });
    mockContextForUser(user, "manage-own");

    const report = await FinancialReportFactory.org(org).create({
      status: AWAITING_APPROVAL,
      nothingToReport: false
    });
    await expectCannot(service, "updateAnswers", report);
  });

  it("allows export and reminder actions for framework users", async () => {
    mockUserContext({ userId: 123, permissions: ["framework-ppc"] });
    const ppc = await FinancialReportFactory.org().create({ frameworkKey: "ppc" });
    await expectAuthority(service, {
      can: [
        ["export", ppc],
        ["sendReminder", ppc]
      ]
    });
  });

  it("allows reading reports for organisations linked via projects-manage", async () => {
    const orgFromProject = await OrganisationFactory.create();
    const otherOrg = await OrganisationFactory.create();
    const user = await UserFactory.create({ organisationId: otherOrg.id });
    const project = await ProjectFactory.create({ organisationId: orgFromProject.id });
    await ProjectUserFactory.create({
      userId: user.id,
      projectId: project.id,
      isMonitoring: false,
      isManaging: true
    });
    mockContextForUser(user, "projects-manage");

    const visible = await FinancialReportFactory.org(orgFromProject).create();
    const hidden = await FinancialReportFactory.org().create({
      organisationId: (await OrganisationFactory.create()).id
    });
    await expectAuthority(service, {
      can: [["read", visible]],
      cannot: [["read", hidden]]
    });
  });

  it("allows read for project-manager in their organisation", async () => {
    const org = await OrganisationFactory.create();
    const user = await UserFactory.create({ organisationId: org.id });
    const pmRole = await RoleFactory.create({ name: "project-manager" });
    await ModelHasRole.create({ modelId: user.id, roleId: pmRole.id, modelType: User.LARAVEL_TYPE });

    mockContextForUser(user);

    const ownOrgReport = await FinancialReportFactory.org(org).create();
    const otherReport = await FinancialReportFactory.org().create();
    await expectAuthority(service, {
      can: [["read", ownOrgReport]],
      cannot: [["read", otherReport]]
    });
  });
});

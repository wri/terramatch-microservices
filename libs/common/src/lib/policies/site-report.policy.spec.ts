import { PolicyService } from "./policy.service";
import { Test } from "@nestjs/testing";
import { expectAuthority, expectCan, expectCannot } from "./policy.service.spec";
import { SiteReport } from "@terramatch-microservices/database/entities";
import {
  OrganisationFactory,
  ProjectFactory,
  ProjectUserFactory,
  SiteFactory,
  SiteReportFactory,
  UserFactory
} from "@terramatch-microservices/database/factories";
import { mockPermissions, mockUserId } from "../util/testing";

describe("SiteReportPolicy", () => {
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

  it("allows reading all site reports with view-dashboard permissions", async () => {
    mockUserId(123);
    mockPermissions("view-dashboard");
    await expectCan(service, "read", new SiteReport());
    await expectCannot(service, "delete", new SiteReport());
  });

  it("allows managing site reports in your framework", async () => {
    mockUserId(123);
    mockPermissions("framework-ppc");
    const ppc = await SiteReportFactory.create({ frameworkKey: "ppc" });
    const tf = await SiteReportFactory.create({ frameworkKey: "terrafund" });
    await expectAuthority(service, {
      can: [[["read", "delete", "update", "approve"], ppc]],
      cannot: [[["read", "delete", "update", "approve"], tf]]
    });
  });

  it("allows managing site reports for own projects", async () => {
    mockPermissions("manage-own");
    const org = await OrganisationFactory.create();
    const user = await UserFactory.create({ organisationId: org.id });
    mockUserId(user.id);

    const p1 = await ProjectFactory.create({ organisationId: org.id });
    const p2 = await ProjectFactory.create();
    const p3 = await ProjectFactory.create();
    const p4 = await ProjectFactory.create();
    await ProjectUserFactory.create({ userId: user.id, projectId: p3.id });
    await ProjectUserFactory.create({ userId: user.id, projectId: p4.id, isMonitoring: false, isManaging: true });

    const s1 = await SiteFactory.create({ projectId: p1.id });
    const s2 = await SiteFactory.create({ projectId: p2.id });
    const s3 = await SiteFactory.create({ projectId: p3.id });
    const s4 = await SiteFactory.create({ projectId: p4.id });

    const sr1 = await SiteReportFactory.create({ siteId: s1.id });
    const sr2 = await SiteReportFactory.create({ siteId: s2.id });
    const sr3 = await SiteReportFactory.create({ siteId: s3.id });
    const sr4 = await SiteReportFactory.create({ siteId: s4.id });

    await expectAuthority(service, {
      can: [
        [["read", "update"], sr1],
        [["read", "update"], sr3],
        [["read", "update"], sr4]
      ],
      cannot: [
        [["delete", "approve"], sr1],
        [["read", "delete"], sr2],
        ["delete", sr3],
        ["delete", sr4]
      ]
    });
  });

  it("allows managing site reports for managed projects", async () => {
    mockPermissions("projects-manage");
    const user = await UserFactory.create();
    mockUserId(user.id);

    const p1 = await ProjectFactory.create();
    const p2 = await ProjectFactory.create();
    await ProjectUserFactory.create({ userId: user.id, projectId: p1.id, isMonitoring: false, isManaging: true });

    const s1 = await SiteFactory.create({ projectId: p1.id });
    const s2 = await SiteFactory.create({ projectId: p2.id });

    const sr1 = await SiteReportFactory.create({ siteId: s1.id });
    const sr2 = await SiteReportFactory.create({ siteId: s2.id });

    await expectAuthority(service, {
      can: [[["read", "delete", "update", "approve"], sr1]],
      cannot: [[["read", "delete", "update", "approve"], sr2]]
    });
  });
});

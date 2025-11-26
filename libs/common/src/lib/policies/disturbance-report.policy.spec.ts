import { PolicyService } from "./policy.service";
import { Test } from "@nestjs/testing";
import { expectAuthority, expectCan, expectCannot } from "./policy.service.spec";
import { DisturbanceReport } from "@terramatch-microservices/database/entities";
import {
  OrganisationFactory,
  ProjectFactory,
  DisturbanceReportFactory,
  ProjectUserFactory,
  UserFactory
} from "@terramatch-microservices/database/factories";
import { mockPermissions, mockUserId } from "../util/testing";

describe("DisturbanceReportPolicy", () => {
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

  it("allows reading all disturbance reports with view-dashboard permissions", async () => {
    mockUserId(123);
    mockPermissions("view-dashboard");
    await expectCan(service, "read", new DisturbanceReport());
    await expectCannot(service, "delete", new DisturbanceReport());
  });

  it("allows managing disturbance reports in your framework", async () => {
    mockUserId(123);
    mockPermissions("framework-ppc");
    const ppc = await DisturbanceReportFactory.create({ frameworkKey: "ppc" });
    const tf = await DisturbanceReportFactory.create({ frameworkKey: "terrafund" });
    await expectAuthority(service, {
      can: [[["read", "delete", "update", "approve", "create"], ppc]],
      cannot: [[["read", "delete", "update", "approve", "create"], tf]]
    });
  });

  it("allows managing disturbance reports for own projects", async () => {
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

    const pr1 = await DisturbanceReportFactory.create({ projectId: p1.id });
    const pr2 = await DisturbanceReportFactory.create({ projectId: p2.id });
    const pr3 = await DisturbanceReportFactory.create({ projectId: p3.id });
    const pr4 = await DisturbanceReportFactory.create({ projectId: p4.id });

    await expectAuthority(service, {
      can: [
        [["read", "update", "create"], pr1],
        [["read", "update", "create"], pr3],
        [["read", "update", "create"], pr4]
      ],
      cannot: [
        [["delete", "approve"], pr1],
        [["read", "delete"], pr2],
        ["delete", pr3],
        ["delete", pr4]
      ]
    });
  });

  it("allows managing disturbance reports for managed projects", async () => {
    mockPermissions("projects-manage");
    const user = await UserFactory.create();
    mockUserId(user.id);

    const p1 = await ProjectFactory.create();
    const p2 = await ProjectFactory.create();
    await ProjectUserFactory.create({ userId: user.id, projectId: p1.id, isMonitoring: false, isManaging: true });

    const pr1 = await DisturbanceReportFactory.create({ projectId: p1.id });
    const pr2 = await DisturbanceReportFactory.create({ projectId: p2.id });

    await expectAuthority(service, {
      can: [[["read", "delete", "update", "approve", "create"], pr1]],
      cannot: [[["read", "delete", "update", "approve", "create"], pr2]]
    });
  });
});

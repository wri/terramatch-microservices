import { PolicyService } from "./policy.service";
import { Test } from "@nestjs/testing";
import { expectCan, expectCannot, mockPermissions, mockUserId } from "./policy.service.spec";
import { ProjectReport } from "@terramatch-microservices/database/entities";
import {
  OrganisationFactory,
  ProjectFactory,
  ProjectReportFactory,
  ProjectUserFactory,
  UserFactory
} from "@terramatch-microservices/database/factories";

describe("ProjectReportPolicy", () => {
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

  it("allows reading all project reports with view-dashboard permissions", async () => {
    mockUserId(123);
    mockPermissions("view-dashboard");
    await expectCan(service, "read", new ProjectReport());
    await expectCannot(service, "delete", new ProjectReport());
  });

  it("allows reading project reports in your framework", async () => {
    mockUserId(123);
    mockPermissions("framework-ppc");
    const ppc = await ProjectReportFactory.create({ frameworkKey: "ppc" });
    const tf = await ProjectReportFactory.create({ frameworkKey: "terrafund" });
    await expectCan(service, "read", ppc);
    await expectCannot(service, "read", tf);
    await expectCan(service, "delete", ppc);
    await expectCannot(service, "delete", tf);
  });

  it("allows reading project reports for own projects", async () => {
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

    const pr1 = await ProjectReportFactory.create({ projectId: p1.id });
    const pr2 = await ProjectReportFactory.create({ projectId: p2.id });
    const pr3 = await ProjectReportFactory.create({ projectId: p3.id });
    const pr4 = await ProjectReportFactory.create({ projectId: p4.id });

    await expectCan(service, "read", pr1);
    await expectCannot(service, "read", pr2);
    await expectCan(service, "read", pr3);
    await expectCan(service, "read", pr4);
    await expectCan(service, "delete", pr1);
    await expectCannot(service, "delete", pr2);
    await expectCan(service, "delete", pr3);
    await expectCan(service, "delete", pr4);
  });

  it("allows reading project reports for managed projects", async () => {
    mockPermissions("projects-manage");
    const user = await UserFactory.create();
    mockUserId(user.id);

    const p1 = await ProjectFactory.create();
    const p2 = await ProjectFactory.create();
    await ProjectUserFactory.create({ userId: user.id, projectId: p1.id, isMonitoring: false, isManaging: true });

    const pr1 = await ProjectReportFactory.create({ projectId: p1.id });
    const pr2 = await ProjectReportFactory.create({ projectId: p2.id });

    await expectCan(service, "read", pr1);
    await expectCannot(service, "read", pr2);
    await expectCan(service, "delete", pr1);
    await expectCannot(service, "delete", pr2);
  });
});

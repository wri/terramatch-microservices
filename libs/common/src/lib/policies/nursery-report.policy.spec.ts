import { PolicyService } from "./policy.service";
import { Test } from "@nestjs/testing";
import { expectCan, expectCannot, mockPermissions, mockUserId } from "./policy.service.spec";
import { NurseryReport } from "@terramatch-microservices/database/entities";
import {
  NurseryFactory,
  NurseryReportFactory,
  OrganisationFactory,
  ProjectFactory,
  ProjectUserFactory,
  UserFactory
} from "@terramatch-microservices/database/factories";

describe("NurseryReportPolicy", () => {
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

  it("allows reading all nursery reports with view-dashboard permissions", async () => {
    mockUserId(123);
    mockPermissions("view-dashboard");
    await expectCan(service, "read", new NurseryReport());
    await expectCannot(service, "delete", new NurseryReport());
  });

  it("allows reading nursery reports in your framework", async () => {
    mockUserId(123);
    mockPermissions("framework-ppc");
    const ppc = await NurseryReportFactory.create({ frameworkKey: "ppc" });
    const tf = await NurseryReportFactory.create({ frameworkKey: "terrafund" });
    await expectCan(service, "read", ppc);
    await expectCannot(service, "read", tf);
    await expectCan(service, "delete", ppc);
    await expectCannot(service, "delete", tf);
  });

  it("allows reading nursery reports for own projects", async () => {
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

    const n1 = await NurseryFactory.create({ projectId: p1.id });
    const n2 = await NurseryFactory.create({ projectId: p2.id });
    const n3 = await NurseryFactory.create({ projectId: p3.id });
    const n4 = await NurseryFactory.create({ projectId: p4.id });

    const nr1 = await NurseryReportFactory.create({ nurseryId: n1.id });
    const nr2 = await NurseryReportFactory.create({ nurseryId: n2.id });
    const nr3 = await NurseryReportFactory.create({ nurseryId: n3.id });
    const nr4 = await NurseryReportFactory.create({ nurseryId: n4.id });

    await expectCan(service, "read", nr1);
    await expectCannot(service, "read", nr2);
    await expectCan(service, "read", nr3);
    await expectCan(service, "read", nr4);
    await expectCannot(service, "delete", nr1);
    await expectCannot(service, "delete", nr2);
    await expectCannot(service, "delete", nr3);
    await expectCannot(service, "delete", nr4);
  });

  it("allows reading nursery reports for managed projects", async () => {
    mockPermissions("projects-manage");
    const user = await UserFactory.create();
    mockUserId(user.id);

    const p1 = await ProjectFactory.create();
    const p2 = await ProjectFactory.create();
    await ProjectUserFactory.create({ userId: user.id, projectId: p1.id, isMonitoring: false, isManaging: true });

    const n1 = await NurseryFactory.create({ projectId: p1.id });
    const n2 = await NurseryFactory.create({ projectId: p2.id });

    const nr1 = await NurseryReportFactory.create({ nurseryId: n1.id });
    const nr2 = await NurseryReportFactory.create({ nurseryId: n2.id });

    await expectCan(service, "read", nr1);
    await expectCannot(service, "read", nr2);
    await expectCan(service, "delete", nr1);
    await expectCannot(service, "delete", nr2);
  });
});

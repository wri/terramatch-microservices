import { PolicyService } from "./policy.service";
import { Test } from "@nestjs/testing";
import { expectAuthority, expectCan, expectCannot } from "./policy.service.spec";
import { NurseryReport } from "@terramatch-microservices/database/entities";
import {
  NurseryFactory,
  NurseryReportFactory,
  OrganisationFactory,
  ProjectFactory,
  ProjectUserFactory,
  UserFactory
} from "@terramatch-microservices/database/factories";
import { mockPermissions, mockUserId } from "../util/testing";

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

  it("allows managing nursery reports in your framework", async () => {
    mockUserId(123);
    mockPermissions("framework-ppc");
    const ppc = await NurseryReportFactory.create({ frameworkKey: "ppc" });
    const tf = await NurseryReportFactory.create({ frameworkKey: "terrafund" });
    await expectAuthority(service, {
      can: [[["read", "delete", "update", "approve", "deleteFiles"], ppc]],
      cannot: [[["read", "delete", "update", "approve", "deleteFiles"], tf]]
    });
  });

  it("allows managing nursery reports for own projects", async () => {
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

    await expectAuthority(service, {
      can: [
        [["read", "update"], nr1],
        [["read", "update", "deleteFiles"], nr3],
        [["read", "update", "deleteFiles"], nr4]
      ],
      cannot: [
        [["delete", "approve"], nr1],
        [["read", "delete"], nr2],
        ["delete", nr3],
        ["delete", nr4]
      ]
    });
  });

  it("allows managing nursery reports for managed projects", async () => {
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

    await expectAuthority(service, {
      can: [[["read", "delete", "update", "approve", "deleteFiles"], nr1]],
      cannot: [[["read", "delete", "update", "approve", "deleteFiles"], nr2]]
    });
  });
});

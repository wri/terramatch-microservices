import { PolicyService } from "./policy.service";
import { Test } from "@nestjs/testing";
import { expectAuthority, expectCan, expectCannot } from "./policy.service.spec";
import { ProjectReport } from "@terramatch-microservices/database/entities";
import {
  OrganisationFactory,
  ProjectFactory,
  ProjectReportFactory,
  ProjectUserFactory,
  UserFactory
} from "@terramatch-microservices/database/factories";
import { mockRequestContext } from "../util/testing";

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
    mockRequestContext({ userId: 123, permissions: ["view-dashboard"] });
    await expectCan(service, "read", new ProjectReport());
    await expectCannot(service, "delete", new ProjectReport());
  });

  it("allows managing project reports in your framework", async () => {
    mockRequestContext({ userId: 123, permissions: ["framework-ppc"] });
    const ppc = await ProjectReportFactory.create({ frameworkKey: "ppc" });
    const tf = await ProjectReportFactory.create({ frameworkKey: "terrafund" });
    await expectAuthority(service, {
      can: [[["read", "delete", "update", "approve", "deleteFiles"], ppc]],
      cannot: [[["read", "delete", "update", "approve", "deleteFiles"], tf]]
    });
  });

  it("allows managing project reports for own projects", async () => {
    const org = await OrganisationFactory.create();
    const user = await UserFactory.create({ organisationId: org.id });
    mockRequestContext({ userId: user.id, permissions: ["manage-own"] });

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

    await expectAuthority(service, {
      can: [
        [["read", "update", "deleteFiles"], pr1],
        [["read", "update", "deleteFiles"], pr3],
        [["read", "update", "deleteFiles"], pr4]
      ],
      cannot: [
        [["delete", "approve"], pr1],
        [["read", "delete"], pr2],
        ["delete", pr3],
        ["delete", pr4]
      ]
    });
  });

  it("allows managing project reports for managed projects", async () => {
    const user = await UserFactory.create();
    mockRequestContext({ userId: user.id, permissions: ["projects-manage"] });

    const p1 = await ProjectFactory.create();
    const p2 = await ProjectFactory.create();
    await ProjectUserFactory.create({ userId: user.id, projectId: p1.id, isMonitoring: false, isManaging: true });

    const pr1 = await ProjectReportFactory.create({ projectId: p1.id });
    const pr2 = await ProjectReportFactory.create({ projectId: p2.id });

    await expectAuthority(service, {
      can: [[["read", "delete", "update", "approve", "deleteFiles"], pr1]],
      cannot: [[["read", "delete", "update", "approve", "deleteFiles"], pr2]]
    });
  });
});

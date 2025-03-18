import { PolicyService } from "./policy.service";
import { Test } from "@nestjs/testing";
import { expectCan, expectCannot, mockPermissions, mockUserId } from "./policy.service.spec";
import { Project } from "@terramatch-microservices/database/entities";
import {
  OrganisationFactory,
  ProjectFactory,
  ProjectUserFactory,
  UserFactory
} from "@terramatch-microservices/database/factories";

describe("ProjectPolicy", () => {
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

  it("allows reading all projects with projects-read permissions", async () => {
    mockUserId(123);
    mockPermissions("projects-read");
    await expectCan(service, "read", new Project());
    await expectCannot(service, "delete", new Project());
  });

  it("allows reading all projects with view-dashboard permissions", async () => {
    mockUserId(123);
    mockPermissions("view-dashboard");
    await expectCan(service, "read", new Project());
    await expectCannot(service, "delete", new Project());
  });

  it("allows reading and deleting projects in your framework", async () => {
    mockUserId(123);
    mockPermissions("framework-ppc");
    const ppc = await ProjectFactory.create({ frameworkKey: "ppc" });
    const tf = await ProjectFactory.create({ frameworkKey: "terrafund" });
    await expectCan(service, "read", ppc);
    await expectCan(service, "delete", ppc);
    await expectCannot(service, "read", tf);
    await expectCannot(service, "delete", tf);
  });

  it("allows reading and deleting own projects", async () => {
    mockPermissions("manage-own");
    const org = await OrganisationFactory.create();
    const user = await UserFactory.create({ organisationId: org.id });
    mockUserId(user.id);

    const p1 = await ProjectFactory.create({ status: "started", organisationId: org.id });
    const p2 = await ProjectFactory.create({ status: "started" });
    const p3 = await ProjectFactory.create({ status: "started" });
    const p4 = await ProjectFactory.create({ status: "awaiting-approval" });
    await ProjectUserFactory.create({ userId: user.id, projectId: p3.id });
    await ProjectUserFactory.create({ userId: user.id, projectId: p4.id, isMonitoring: false, isManaging: true });
    await expectCan(service, "read", p1);
    await expectCan(service, "delete", p1);
    await expectCannot(service, "read", p2);
    await expectCannot(service, "delete", p2);
    await expectCan(service, "read", p3);
    await expectCan(service, "delete", p3);
    await expectCan(service, "read", p4);
    // This project is not in the "started" state
    await expectCannot(service, "delete", p4);
  });

  it("allows reading and deleting managed projects", async () => {
    mockPermissions("projects-manage");
    const user = await UserFactory.create();
    mockUserId(user.id);
    const p1 = await ProjectFactory.create();
    const p2 = await ProjectFactory.create();
    await ProjectUserFactory.create({ userId: user.id, projectId: p1.id, isMonitoring: false, isManaging: true });
    await expectCan(service, "read", p1);
    await expectCan(service, "delete", p1);
    await expectCannot(service, "read", p2);
    await expectCannot(service, "delete", p2);
  });
});

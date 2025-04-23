import { PolicyService } from "./policy.service";
import { Test } from "@nestjs/testing";
import { expectAuthority, expectCan, expectCannot, mockPermissions, mockUserId } from "./policy.service.spec";
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

  it("allows managing projects in your framework", async () => {
    mockUserId(123);
    mockPermissions("framework-ppc");
    const ppc = await ProjectFactory.create({ frameworkKey: "ppc" });
    const tf = await ProjectFactory.create({ frameworkKey: "terrafund" });
    await expectAuthority(service, {
      can: [[["read", "delete", "update", "approve"], ppc]],
      cannot: [[["read", "delete", "update", "approve"], tf]]
    });
  });

  it("allows managing own projects", async () => {
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
    await expectAuthority(service, {
      can: [
        [["read", "update", "delete"], p1],
        [["read", "update", "delete"], p3],
        [["read", "update"], p4]
      ],
      cannot: [
        // manage-own does not give permission to approve.
        ["approve", p1],
        [["read", "update", "delete"], p2],
        // This project is not in the "started" state
        ["delete", p4]
      ]
    });
  });

  it("allows reading and deleting managed projects", async () => {
    mockPermissions("projects-manage");
    const user = await UserFactory.create();
    mockUserId(user.id);
    const p1 = await ProjectFactory.create();
    const p2 = await ProjectFactory.create();
    await ProjectUserFactory.create({ userId: user.id, projectId: p1.id, isMonitoring: false, isManaging: true });
    await expectAuthority(service, {
      can: [[["read", "delete", "update", "approve"], p1]],
      cannot: [[["read", "delete", "update", "approve"], p2]]
    });
  });
});

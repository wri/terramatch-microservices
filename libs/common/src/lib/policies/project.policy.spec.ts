import { PolicyService } from "./policy.service";
import { Test } from "@nestjs/testing";
import { expectAuthority, expectCan, expectCannot } from "./policy.service.spec";
import { Project, User } from "@terramatch-microservices/database/entities";
import {
  OrganisationFactory,
  ProjectFactory,
  ProjectUserFactory,
  UserFactory
} from "@terramatch-microservices/database/factories";
import { mockPermissions, mockUserId } from "../util/testing";

describe("ProjectPolicy", () => {
  let service: PolicyService;
  const originalUserFindOne = User.findOne.bind(User);

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [PolicyService]
    }).compile();

    service = await module.resolve(PolicyService);

    // isVerifiedAdmin() queries User with roles; avoid hitting DB for that lookup in tests that use factories.
    jest.spyOn(User, "findOne").mockImplementation(async options => {
      const include = (options as { include?: unknown[] })?.include ?? [];
      const wantsRoles =
        Array.isArray(include) && include.some((i: { association?: string }) => i?.association === "roles");
      if (wantsRoles) {
        const fallback = new User();
        (fallback as unknown as { emailAddressVerifiedAt: Date | null }).emailAddressVerifiedAt = null;
        (fallback as unknown as { roles: Array<{ name: string }> }).roles = [];
        return fallback;
      }
      return originalUserFindOne(options as Parameters<typeof User.findOne>[0]);
    });
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
        [["read", "update", "delete", "deleteFiles"], p1],
        [["read", "update", "delete", "deleteFiles"], p3],
        [["read", "update"], p4]
      ],
      cannot: [
        // manage-own does not give permission to approve.
        ["approve", p1],
        [["read", "update", "delete", "deleteFiles"], p2],
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
      can: [[["read", "delete", "update", "approve", "deleteFiles"], p1]],
      cannot: [[["read", "delete", "update", "approve", "deleteFiles"], p2]]
    });
  });

  it("allows verified admin to approve projects (e.g. null or unmatched frameworkKey)", async () => {
    mockPermissions();
    mockUserId(123);

    const verifiedAdminUser = new User();
    (verifiedAdminUser as unknown as { emailAddressVerifiedAt: Date | null }).emailAddressVerifiedAt = new Date();
    (verifiedAdminUser as unknown as { roles: Array<{ name: string }> }).roles = [{ name: "admin-super" }];

    jest.spyOn(User, "findOne").mockResolvedValue(verifiedAdminUser);

    await expectCan(service, "approve", new Project());
  });

  it("does not allow unverified admin to approve without framework or projects-manage", async () => {
    mockPermissions();
    mockUserId(123);

    const unverifiedAdminUser = new User();
    (unverifiedAdminUser as unknown as { emailAddressVerifiedAt: Date | null }).emailAddressVerifiedAt = null;
    (unverifiedAdminUser as unknown as { roles: Array<{ name: string }> }).roles = [{ name: "admin-super" }];

    jest.spyOn(User, "findOne").mockResolvedValue(unverifiedAdminUser);

    await expectCannot(service, "approve", new Project());
  });
});

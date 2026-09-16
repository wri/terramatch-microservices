import { Test } from "@nestjs/testing";
import {
  PolygonAttributeDefinitionFactory,
  ProjectFactory,
  ProjectUserFactory,
  SiteFactory,
  UserFactory
} from "@terramatch-microservices/database/factories";
import { PolicyService } from "./policy.service";
import { expectCan, expectCannot } from "./policy.service.spec";
import { mockContextForUser, mockUserContext } from "../util/testing";

describe("PolygonAttributeDefinitionPolicy", () => {
  let service: PolicyService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [PolicyService]
    }).compile();

    service = await module.resolve(PolicyService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("allows CRUD for the user's frameworks and denies others", async () => {
    mockUserContext({ userId: 123, permissions: ["framework-ppc"] });
    const ppc = await PolygonAttributeDefinitionFactory.create({ frameworkKey: "ppc" });
    const terrafund = await PolygonAttributeDefinitionFactory.create({ frameworkKey: "terrafund" });

    await expectCan(service, ["read", "create", "update", "delete"], ppc);
    await expectCannot(service, ["read", "create", "update", "delete"], terrafund);
  });

  it("denies all actions when the user has no framework permissions", async () => {
    mockUserContext({ userId: 123, permissions: [] });
    const definition = await PolygonAttributeDefinitionFactory.create({ frameworkKey: "ppc" });

    await expectCannot(service, ["read", "create", "update", "delete"], definition);
  });

  it("allows reading definitions for own projects with manage-own, but not create/update/delete", async () => {
    const user = await UserFactory.create();
    const project = await ProjectFactory.create();
    await ProjectUserFactory.create({ userId: user.id, projectId: project.id });
    await SiteFactory.create({ projectId: project.id, frameworkKey: "ppc" });
    const definition = await PolygonAttributeDefinitionFactory.create({ frameworkKey: "ppc" });
    const otherFrameworkDefinition = await PolygonAttributeDefinitionFactory.create({ frameworkKey: "terrafund" });

    mockContextForUser(user, "manage-own");

    await expectCan(service, "read", definition);
    await expectCannot(service, ["create", "update", "delete"], definition);
    await expectCannot(service, "read", otherFrameworkDefinition);
  });

  it("allows reading definitions for managed projects with projects-manage", async () => {
    const user = await UserFactory.create();
    const project = await ProjectFactory.create();
    await ProjectUserFactory.create({ userId: user.id, projectId: project.id, isManaging: true });
    await SiteFactory.create({ projectId: project.id, frameworkKey: "ppc" });
    const definition = await PolygonAttributeDefinitionFactory.create({ frameworkKey: "ppc" });

    mockContextForUser(user, "projects-manage");

    await expectCan(service, "read", definition);
    await expectCannot(service, ["create", "update", "delete"], definition);
  });

  it("disallows reading definitions for non-managed projects with projects-manage", async () => {
    const user = await UserFactory.create();
    const project = await ProjectFactory.create();
    await ProjectUserFactory.create({ userId: user.id, projectId: project.id, isManaging: false });
    await SiteFactory.create({ projectId: project.id, frameworkKey: "ppc" });
    const definition = await PolygonAttributeDefinitionFactory.create({ frameworkKey: "ppc" });

    mockContextForUser(user, "projects-manage");

    await expectCannot(service, "read", definition);
  });
});

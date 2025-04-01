import { PolicyService } from "./policy.service";
import { Test } from "@nestjs/testing";
import { expectCan, expectCannot, mockPermissions, mockUserId } from "./policy.service.spec";
import { Site } from "@terramatch-microservices/database/entities";
import {
  OrganisationFactory,
  ProjectFactory,
  ProjectUserFactory,
  SiteFactory,
  UserFactory
} from "@terramatch-microservices/database/factories";

describe("SitePolicy", () => {
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

  it("allows reading all sites with view-dashboard permissions", async () => {
    mockUserId(123);
    mockPermissions("view-dashboard");
    await expectCan(service, "read", new Site());
    await expectCannot(service, "delete", new Site());
  });

  it("allows reading all sites with projects-read permissions", async () => {
    mockUserId(123);
    mockPermissions("projects-read");
    await expectCan(service, "read", new Site());
  });

  it("allows reading sites in your framework", async () => {
    mockUserId(123);
    mockPermissions("framework-ppc");
    const ppc = await SiteFactory.create({ frameworkKey: "ppc" });
    const tf = await SiteFactory.create({ frameworkKey: "terrafund" });
    await expectCan(service, "read", ppc);
    await expectCannot(service, "read", tf);
    await expectCan(service, "delete", ppc);
    await expectCannot(service, "delete", tf);
  });

  it("allows reading own sites", async () => {
    mockPermissions("manage-own");
    const org = await OrganisationFactory.create();
    const user = await UserFactory.create({ organisationId: org.id });
    mockUserId(user.id);

    const p1 = await ProjectFactory.create({ organisationId: org.id });
    const p2 = await ProjectFactory.create();
    const p3 = await ProjectFactory.create();
    const p4 = await ProjectFactory.create();

    await ProjectUserFactory.create({ userId: user.id, projectId: p1.id });
    await ProjectUserFactory.create({ userId: user.id, projectId: p3.id });
    await ProjectUserFactory.create({ userId: user.id, projectId: p4.id, isMonitoring: false, isManaging: true });

    const s1 = await SiteFactory.create({ projectId: p1.id });
    const s2 = await SiteFactory.create({ projectId: p2.id });
    const s3 = await SiteFactory.create({ projectId: p3.id });
    const s4 = await SiteFactory.create({ projectId: p4.id });
    await expectCan(service, "read", s1);
    await expectCannot(service, "read", s2);
    await expectCan(service, "read", s3);
    await expectCan(service, "read", s4);
    await expectCan(service, "delete", s1);
    await expectCannot(service, "delete", s2);
    await expectCan(service, "delete", s3);
    await expectCan(service, "delete", s4);
  });

  it("allows reading managed sites", async () => {
    mockPermissions("projects-manage");
    const user = await UserFactory.create();
    const project = await ProjectFactory.create();
    await ProjectUserFactory.create({ userId: user.id, projectId: project.id, isMonitoring: false, isManaging: true });
    mockUserId(user.id);
    const s1 = await SiteFactory.create({ projectId: project.id });
    const s2 = await SiteFactory.create();
    await expectCan(service, "read", s1);
    await expectCannot(service, "read", s2);
    await expectCan(service, "delete", s1);
    await expectCannot(service, "delete", s2);
  });
});

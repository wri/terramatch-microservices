import { Test } from "@nestjs/testing";
import { PolicyService } from "./policy.service";
import { expectCan, expectCannot, mockPermissions, mockUserId } from "./policy.service.spec";
import { Nursery } from "@terramatch-microservices/database/entities";
import {
  NurseryFactory,
  OrganisationFactory,
  ProjectFactory,
  ProjectUserFactory,
  UserFactory
} from "@terramatch-microservices/database/factories";

describe("NurseryPolicy", () => {
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

  it("allows reading all Nursery with view-dashboard permissions", async () => {
    mockUserId(123);
    mockPermissions("view-dashboard");
    await expectCan(service, "read", new Nursery());
  });

  it("allows reading nurseries in your framework", async () => {
    mockUserId(123);
    mockPermissions("framework-terrafund");
    const ppc = await NurseryFactory.create({ frameworkKey: "ppc" });
    const tf = await NurseryFactory.create({ frameworkKey: "terrafund" });
    await expectCan(service, "read", tf);
    await expectCannot(service, "read", ppc);
  });

  it("allows reading own nurseries", async () => {
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

    const n1 = await NurseryFactory.create({ projectId: p1.id });
    const n2 = await NurseryFactory.create({ projectId: p2.id });
    const n3 = await NurseryFactory.create({ projectId: p3.id });
    const n4 = await NurseryFactory.create({ projectId: p4.id });
    await expectCan(service, "read", n1);
    await expectCannot(service, "read", n2);
    await expectCan(service, "read", n3);
    await expectCan(service, "read", n4);
  });

  it("allows reading managed nurseries", async () => {
    mockPermissions("projects-manage");
    const user = await UserFactory.create();
    const project = await ProjectFactory.create();
    await ProjectUserFactory.create({ userId: user.id, projectId: project.id, isMonitoring: false, isManaging: true });
    mockUserId(user.id);
    const n1 = await NurseryFactory.create({ projectId: project.id });
    const n2 = await NurseryFactory.create();
    await expectCan(service, "read", n1);
    await expectCannot(service, "read", n2);
  });
});

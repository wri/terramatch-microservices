import { PolicyService } from "./policy.service";
import { Test } from "@nestjs/testing";
import { expectAuthority, expectCan, expectCannot } from "./policy.service.spec";
import { Nursery } from "@terramatch-microservices/database/entities";
import {
  NurseryFactory,
  OrganisationFactory,
  ProjectFactory,
  ProjectUserFactory,
  UserFactory
} from "@terramatch-microservices/database/factories";
import { mockPermissions, mockUserId } from "../util/testing";

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

  it("allows reading all nurseries with view-dashboard permissions", async () => {
    mockUserId(123);
    mockPermissions("view-dashboard");
    await expectCan(service, "read", new Nursery());
    await expectCannot(service, "delete", new Nursery());
  });

  it("allows reading all nurseries with projects-read permissions", async () => {
    mockUserId(123);
    mockPermissions("projects-read");
    await expectCan(service, "read", new Nursery());
  });

  it("allows managing nurseries in your framework", async () => {
    mockUserId(123);
    mockPermissions("framework-ppc");
    const ppc = await NurseryFactory.create({ frameworkKey: "ppc" });
    const tf = await NurseryFactory.create({ frameworkKey: "terrafund" });
    await expectAuthority(service, {
      can: [[["read", "delete", "update", "approve", "deleteFiles"], ppc]],
      cannot: [[["read", "delete", "update", "approve", "deleteFiles"], tf]]
    });
  });

  it("allows managing own nurseries", async () => {
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

    const s1 = await NurseryFactory.create({ projectId: p1.id });
    const s2 = await NurseryFactory.create({ projectId: p2.id });
    const s3 = await NurseryFactory.create({ projectId: p3.id });
    const s4 = await NurseryFactory.create({ projectId: p4.id });

    await expectAuthority(service, {
      can: [
        [["read", "delete", "update", "deleteFiles"], s1],
        [["read", "delete", "update", "deleteFiles"], s3],
        [["read", "delete", "update", "deleteFiles"], s4]
      ],
      cannot: [
        ["approve", s1],
        [["read", "delete", "update"], s2]
      ]
    });
  });

  it("allows managing managed nurseries", async () => {
    mockPermissions("projects-manage");
    const user = await UserFactory.create();
    const project = await ProjectFactory.create();
    await ProjectUserFactory.create({ userId: user.id, projectId: project.id, isMonitoring: false, isManaging: true });
    mockUserId(user.id);
    const s1 = await NurseryFactory.create({ projectId: project.id });
    const s2 = await NurseryFactory.create();
    await expectAuthority(service, {
      can: [[["read", "delete", "update", "approve", "deleteFiles"], s1]],
      cannot: [[["read", "delete", "update", "approve", "deleteFiles"], s2]]
    });
  });
});

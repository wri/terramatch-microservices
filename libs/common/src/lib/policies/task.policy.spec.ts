import { PolicyService } from "./policy.service";
import { Test } from "@nestjs/testing";
import { expectAuthority } from "./policy.service.spec";
import {
  OrganisationFactory,
  ProjectFactory,
  ProjectUserFactory,
  TaskFactory,
  UserFactory
} from "@terramatch-microservices/database/factories";
import { mockPermissions, mockUserId } from "../util/testing";

describe("TaskPolicy", () => {
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

  it("allows reading and updating tasks in your framework", async () => {
    mockUserId(123);
    mockPermissions("framework-ppc");
    const ppc = await ProjectFactory.create({ frameworkKey: "ppc" });
    const ppcTask = await TaskFactory.create({ projectId: ppc.id });
    ppcTask.project = ppc;
    const tf = await ProjectFactory.create({ frameworkKey: "terrafund" });
    const tfTask = await TaskFactory.create({ projectId: tf.id });
    tfTask.project = tf;

    await expectAuthority(service, {
      can: [[["read", "update"], ppcTask]],
      cannot: [[["read", "update"], tfTask]]
    });
  });

  it("allows reading and updating tasks for own projects", async () => {
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

    const t1 = await TaskFactory.create({ projectId: p1.id });
    t1.project = p1;
    const t2 = await TaskFactory.create({ projectId: p2.id });
    t2.project = p2;
    const t3 = await TaskFactory.create({ projectId: p3.id });
    t3.project = p3;
    const t4 = await TaskFactory.create({ projectId: p4.id });
    t4.project = p4;

    await expectAuthority(service, {
      can: [
        [["read", "update"], t1],
        [["read", "update"], t3],
        [["read", "update"], t4]
      ],
      cannot: [["read", t2]]
    });
  });

  it("allows reading and updating tasks for managed projects", async () => {
    mockPermissions("projects-manage");
    const user = await UserFactory.create();
    mockUserId(user.id);

    const p1 = await ProjectFactory.create();
    const p2 = await ProjectFactory.create();
    await ProjectUserFactory.create({ userId: user.id, projectId: p1.id, isMonitoring: false, isManaging: true });

    const t1 = await TaskFactory.create({ projectId: p1.id });
    t1.project = p1;
    const t2 = await TaskFactory.create({ projectId: p2.id });
    t2.project = p2;

    await expectAuthority(service, {
      can: [[["read", "update"], t1]],
      cannot: [[["read", "update"], t2]]
    });
  });
});

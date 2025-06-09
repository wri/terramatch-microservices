import { PolicyService } from "./policy.service";
import { Test } from "@nestjs/testing";
import { expectAuthority, expectCan, expectCannot, mockPermissions, mockUserId } from "./policy.service.spec";
import { Form } from "@terramatch-microservices/database/entities";
import { FormFactory, UserFactory } from "@terramatch-microservices/database/factories";

describe("FormPolicy", () => {
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

  it("allows managing forms in your framework", async () => {
    mockUserId(123);
    mockPermissions("framework-ppc");
    const ppc = await FormFactory.create({ frameworkKey: "ppc" });
    const tf = await FormFactory.create({ frameworkKey: "terrafund" });
    await expectAuthority(service, {
      can: [[["read", "update", "delete", "uploadFiles"], ppc]],
      cannot: [[["read", "update", "delete", "uploadFiles"], tf]]
    });
  });

  it("allows managing forms with forms-manage permission", async () => {
    mockUserId(123);
    mockPermissions("forms-manage");
    const form = await FormFactory.create();
    await expectCan(service, ["read", "create", "update", "delete", "uploadFiles"], form);
  });

  it("allows managing forms created/updated by the user", async () => {
    const user = await UserFactory.create();
    mockUserId(user.id);
    mockPermissions();
    const form = await FormFactory.create({ updatedBy: user.id });
    await expectCan(service, ["read", "update", "uploadFiles"], form);
  });

  it("disallows managing forms without proper permissions", async () => {
    mockUserId(123);
    mockPermissions();
    const form = await FormFactory.create();
    await expectCannot(service, ["read", "update", "delete", "uploadFiles"], form);
  });
});

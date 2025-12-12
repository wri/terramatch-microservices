import { Test } from "@nestjs/testing";
import { PolicyService } from "./policy.service";
import { AuditStatusFactory, UserFactory } from "@terramatch-microservices/database/factories";
import { expectCan } from "./policy.service.spec";
import { mockPermissions, mockUserId } from "../util/testing";

describe("AuditStatusPolicy", () => {
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

  it("should allow upload files if user is managing projects", async () => {
    const user = await UserFactory.create();
    mockUserId(user.id);
    mockPermissions();
    const auditStatus = await AuditStatusFactory.project().create({ createdBy: user.emailAddress });
    await expectCan(service, "uploadFiles", auditStatus);
  });
});

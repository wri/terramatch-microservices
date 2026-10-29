import { PolicyService } from "./policy.service";
import { Test } from "@nestjs/testing";
import { mockUserContext, mockContextForUser } from "../util/testing";
import { expectCan, expectCannot } from "./policy.service.spec";
import { Application } from "@terramatch-microservices/database/entities";
import {
  ApplicationFactory,
  OrganisationFactory,
  OrganisationJoinRequestFactory,
  UserFactory
} from "@terramatch-microservices/database/factories";

describe("ApplicationPolicy", () => {
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

  it("allows reading applications for all admins", async () => {
    mockUserContext({ userId: 123, permissions: ["framework-terrafund"] });
    await expectCan(service, "read", new Application());
  });

  it("allows reading own org applications", async () => {
    const org = await OrganisationFactory.create();
    const user = await UserFactory.create({ organisationId: org.id });
    mockContextForUser(user, "manage-own");
    let application = await ApplicationFactory.create({ organisationUuid: org.uuid });
    await expectCan(service, "read", application);
    application = await ApplicationFactory.create();
    await expectCannot(service, "read", application);
  });

  it("does not allow reading applications of an org the user has requested to join", async () => {
    const associatedOrg = await OrganisationFactory.create();
    const pendingOrg = await OrganisationFactory.create();
    const user = await UserFactory.create({ organisationId: associatedOrg.id });
    mockContextForUser(user, "manage-own");
    await OrganisationJoinRequestFactory.create({ organisationId: pendingOrg.id, userId: user.id, status: "pending" });
    const associatedSubmission = await ApplicationFactory.create({ organisationUuid: associatedOrg.uuid });
    const pendingSubmission = await ApplicationFactory.create({ organisationUuid: pendingOrg.uuid });
    await expectCan(service, "read", associatedSubmission);
    await expectCannot(service, "read", pendingSubmission);
  });
});

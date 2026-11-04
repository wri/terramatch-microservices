import { PolicyService } from "./policy.service";
import { Test } from "@nestjs/testing";
import { mockUserContext, mockContextForUser } from "../util/testing";
import { expectCan, expectCannot } from "./policy.service.spec";
import { FormSubmission } from "@terramatch-microservices/database/entities";
import {
  FormSubmissionFactory,
  OrganisationFactory,
  OrganisationJoinRequestFactory,
  UserFactory
} from "@terramatch-microservices/database/factories";

describe("FormSubmissionPolicy", () => {
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

  it("allows reading form submission for all admins", async () => {
    mockUserContext({ userId: 123, permissions: ["framework-terrafund"] });
    await expectCan(service, "read", new FormSubmission());
  });

  it("allows reading own org submissions", async () => {
    const org = await OrganisationFactory.create();
    const user = await UserFactory.create({ organisationId: org.id });
    mockContextForUser(user, "manage-own");
    let submission = await FormSubmissionFactory.create({ organisationUuid: org.uuid });
    await expectCan(service, "read", submission);
    submission = await FormSubmissionFactory.create({ organisationUuid: "other-org" });
    await expectCannot(service, "read", submission);
  });

  it("does not allow reading submissions of an org the user has requested to join", async () => {
    const associatedOrg = await OrganisationFactory.create();
    const pendingOrg = await OrganisationFactory.create();
    const user = await UserFactory.create({ organisationId: associatedOrg.id });
    mockContextForUser(user, "manage-own");
    await OrganisationJoinRequestFactory.create({ organisationId: pendingOrg.id, userId: user.id, status: "pending" });
    const associatedSubmission = await FormSubmissionFactory.create({ organisationUuid: associatedOrg.uuid });
    const pendingSubmission = await FormSubmissionFactory.create({ organisationUuid: pendingOrg.uuid });
    await expectCan(service, "read", associatedSubmission);
    await expectCannot(service, "read", pendingSubmission);
  });
});

import { PolicyService } from "./policy.service";
import { Test } from "@nestjs/testing";
import { mockPermissions, mockUserId } from "../util/testing";
import { expectCan, expectCannot } from "./policy.service.spec";
import { FormSubmission } from "@terramatch-microservices/database/entities";
import {
  FormSubmissionFactory,
  OrganisationFactory,
  OrganisationUserFactory,
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
    mockUserId(123);
    mockPermissions("framework-terrafund");
    await expectCan(service, "read", new FormSubmission());
  });

  it("allows reading own org submissions", async () => {
    mockPermissions("manage-own");
    const org = await OrganisationFactory.create();
    const user = await UserFactory.create({ organisationId: org.id });
    mockUserId(user.id);
    let submission = await FormSubmissionFactory.create({ organisationUuid: org.uuid });
    await expectCan(service, "read", submission);
    submission = await FormSubmissionFactory.create({ organisationUuid: "other-org" });
    await expectCannot(service, "read", submission);
  });

  it("allows reading associated org submissions", async () => {
    mockPermissions("manage-own");
    const associatedOrg = await OrganisationFactory.create();
    const pendingOrg = await OrganisationFactory.create();
    const user = await UserFactory.create();
    mockUserId(user.id);
    await OrganisationUserFactory.create({ organisationId: associatedOrg.id, userId: user.id, status: "approved" });
    await OrganisationUserFactory.create({ organisationId: pendingOrg.id, userId: user.id, status: "requested" });
    const associatedSubmission = await FormSubmissionFactory.create({ organisationUuid: associatedOrg.uuid });
    const pendingSubmission = await FormSubmissionFactory.create({ organisationUuid: pendingOrg.uuid });
    await expectCan(service, "read", associatedSubmission);
    await expectCannot(service, "read", pendingSubmission);
  });
});

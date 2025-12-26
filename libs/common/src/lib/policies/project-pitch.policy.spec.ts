import { PolicyService } from "./policy.service";
import { Test } from "@nestjs/testing";
import { expectCan, expectCannot } from "./policy.service.spec";
import { ProjectPitch } from "@terramatch-microservices/database/entities";
import { mockPermissions, mockUserId } from "../util/testing";
import { OrganisationFactory, ProjectPitchFactory, UserFactory } from "@terramatch-microservices/database/factories";

describe("ProjectPitchPolicy", () => {
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

  it("allows reading all project pitch with framework permissions", async () => {
    mockUserId(123);
    mockPermissions("framework-ppc");
    await expectCan(service, "read", new ProjectPitch());
    await expectCannot(service, "delete", new ProjectPitch());
  });

  it("deny reading all project pitch with projects-read permissions", async () => {
    mockUserId(123);
    mockPermissions("projects-read");
    await expectCannot(service, "read", new ProjectPitch());
  });

  it("allows managing own org pitches", async () => {
    mockPermissions("manage-own");
    const org = await OrganisationFactory.create();
    const user = await UserFactory.create({ organisationId: org.id });
    mockUserId(user.id);
    let pitch = await ProjectPitchFactory.create({ organisationId: org.uuid });
    await expectCan(service, "read", pitch);
    await expectCan(service, "update", pitch);
    await expectCan(service, "uploadFiles", pitch);
    pitch = await ProjectPitchFactory.create();
    await expectCannot(service, "read", pitch);
    await expectCannot(service, "update", pitch);
    await expectCannot(service, "uploadFiles", pitch);
  });
});

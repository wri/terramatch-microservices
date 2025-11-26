import { PolicyService } from "./policy.service";
import { Test } from "@nestjs/testing";
import { expectCan, expectCannot } from "./policy.service.spec";
import { Organisation } from "@terramatch-microservices/database/entities";
import { OrganisationFactory, UserFactory } from "@terramatch-microservices/database/factories";
import { mockPermissions, mockUserId } from "../util/testing";

describe("OrganisationPolicy", () => {
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

  it("allows creating organisations with users-manage permissions", async () => {
    mockUserId(123);
    mockPermissions("users-manage");
    await expectCan(service, "create", Organisation);
  });

  it("disallows creating organisations without users-manage permissions", async () => {
    mockUserId(123);
    mockPermissions();
    await expectCannot(service, "create", Organisation);
  });

  it("allows uploading files to the user's org", async () => {
    const org = await OrganisationFactory.create();
    const user = await UserFactory.create({ organisationId: org.id });
    mockUserId(user.id);
    mockPermissions("manage-own");
    await expectCan(service, "uploadFiles", org);
  });

  it("disallows uploading files to other orgs", async () => {
    const orgs = await OrganisationFactory.createMany(2);
    const user = await UserFactory.create({ organisationId: orgs[0].id });
    mockUserId(user.id);
    mockPermissions("manage-own");
    await expectCannot(service, "uploadFiles", orgs[1]);
  });
});

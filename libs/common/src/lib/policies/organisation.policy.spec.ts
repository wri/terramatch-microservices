import { PolicyService } from "./policy.service";
import { Test } from "@nestjs/testing";
import { expectCan, expectCannot } from "./policy.service.spec";
import { Organisation, User, ModelHasRole } from "@terramatch-microservices/database/entities";
import {
  OrganisationFactory,
  OrganisationUserFactory,
  ProjectFactory,
  ProjectUserFactory,
  UserFactory,
  RoleFactory
} from "@terramatch-microservices/database/factories";
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

  describe("framework permissions", () => {
    it("allows reading, updating, and deleting organisations with framework permissions", async () => {
      mockUserId(123);
      mockPermissions("framework-ppc");
      const org = await OrganisationFactory.create();
      await expectCan(service, ["read", "update", "delete"], org);
    });

    it("disallows reading organisations without framework permissions", async () => {
      mockUserId(123);
      mockPermissions();
      const org = await OrganisationFactory.create();
      await expectCannot(service, "read", org);
    });
  });

  describe("users-manage permissions", () => {
    it("allows creating organisations for all authenticated users", async () => {
      mockUserId(123);
      mockPermissions();
      await expectCan(service, "create", Organisation);
    });

    it("allows uploading, deleting, and updating files with users-manage permissions", async () => {
      mockUserId(123);
      mockPermissions("users-manage");
      const org = await OrganisationFactory.create();
      await expectCan(service, ["uploadFiles", "deleteFiles", "updateFiles"], org);
    });

    it("allows deleting organisations with users-manage permissions", async () => {
      mockUserId(123);
      mockPermissions("users-manage");
      const org = await OrganisationFactory.create();
      await expectCan(service, "delete", org);
    });
  });

  describe("orgUuids read access", () => {
    it("allows reading organisations via orgUuids", async () => {
      const org = await OrganisationFactory.create();
      const user = await UserFactory.create({ organisationId: org.id });
      mockUserId(user.id);
      mockPermissions("manage-own");
      await expectCan(service, "read", org);
    });

    it("allows reading organisations via organisationsConfirmed", async () => {
      const org = await OrganisationFactory.create();
      const user = await UserFactory.create();
      mockUserId(user.id);
      mockPermissions("manage-own");
      await OrganisationUserFactory.create({ organisationId: org.id, userId: user.id, status: "approved" });
      await expectCan(service, "read", org);
    });

    it("disallows reading organisations not in orgUuids", async () => {
      const orgs = await OrganisationFactory.createMany(2);
      const user = await UserFactory.create({ organisationId: orgs[0].id });
      mockUserId(user.id);
      mockPermissions("manage-own");
      await expectCannot(service, "read", orgs[1]);
    });
  });

  describe("projectOrgIds read access", () => {
    it("allows reading organisations via project organisationIds", async () => {
      const org = await OrganisationFactory.create();
      const user = await UserFactory.create();
      mockUserId(user.id);
      mockPermissions("manage-own");
      const project = await ProjectFactory.create({ organisationId: org.id });
      await ProjectUserFactory.create({ userId: user.id, projectId: project.id });
      await expectCan(service, "read", org);
    });

    it("disallows reading organisations not associated with user's projects", async () => {
      const orgs = await OrganisationFactory.createMany(2);
      const user = await UserFactory.create();
      mockUserId(user.id);
      mockPermissions("manage-own");
      const project = await ProjectFactory.create({ organisationId: orgs[0].id });
      await ProjectUserFactory.create({ userId: user.id, projectId: project.id });
      await expectCannot(service, "read", orgs[1]);
    });
  });

  describe("manage-own permissions", () => {
    it("allows uploading and deleting files to the user's org", async () => {
      const org = await OrganisationFactory.create();
      const user = await UserFactory.create({ organisationId: org.id });
      mockUserId(user.id);
      mockPermissions("manage-own");
      await expectCan(service, ["uploadFiles", "deleteFiles"], org);
    });

    it("allows updating and updating files to the user's primary org", async () => {
      const org = await OrganisationFactory.create();
      const user = await UserFactory.create({ organisationId: org.id });
      mockUserId(user.id);
      mockPermissions("manage-own");
      await expectCan(service, ["update", "updateFiles"], org);
    });

    it("disallows uploading and deleting files to other orgs", async () => {
      const orgs = await OrganisationFactory.createMany(2);
      const user = await UserFactory.create({ organisationId: orgs[0].id });
      mockUserId(user.id);
      mockPermissions("manage-own");
      await expectCannot(service, ["uploadFiles", "deleteFiles"], orgs[1]);
    });

    it("allows updating organisations via organisationsConfirmed", async () => {
      const org = await OrganisationFactory.create();
      const user = await UserFactory.create();
      mockUserId(user.id);
      mockPermissions("manage-own");
      await OrganisationUserFactory.create({ organisationId: org.id, userId: user.id, status: "approved" });
      await expectCan(service, "update", org);
    });

    it("disallows updating organisations not in organisationsConfirmed", async () => {
      const orgs = await OrganisationFactory.createMany(2);
      const user = await UserFactory.create();
      mockUserId(user.id);
      mockPermissions("manage-own");
      await OrganisationUserFactory.create({ organisationId: orgs[0].id, userId: user.id, status: "approved" });
      await expectCannot(service, "update", orgs[1]);
    });

    it("disallows updating organisations with requested status when user has primary org", async () => {
      const primaryOrg = await OrganisationFactory.create();
      const requestedOrg = await OrganisationFactory.create();
      const user = await UserFactory.create({ organisationId: primaryOrg.id });
      mockUserId(user.id);
      mockPermissions("manage-own");
      await OrganisationUserFactory.create({ organisationId: requestedOrg.id, userId: user.id, status: "requested" });
      await expectCan(service, "update", primaryOrg);
      await expectCannot(service, "update", requestedOrg);
    });

    it("allows deleting draft organisations for user's primary org", async () => {
      const draftOrg = await OrganisationFactory.create({ status: "draft" });
      const user = await UserFactory.create({ organisationId: draftOrg.id });
      mockUserId(user.id);
      mockPermissions("manage-own");
      await expectCan(service, "delete", draftOrg);
    });

    it("disallows deleting non-draft organisations for user's primary org", async () => {
      const pendingOrg = await OrganisationFactory.create({ status: "pending" });
      const user = await UserFactory.create({ organisationId: pendingOrg.id });
      mockUserId(user.id);
      mockPermissions("manage-own");
      await expectCannot(service, "delete", pendingOrg);
    });
  });

  describe("approveReject permissions", () => {
    it("allows approveReject for verified admin users (admin role + email verified)", async () => {
      const org = await OrganisationFactory.create();
      const adminRole = await RoleFactory.create({ name: "admin-super" });
      const user = await UserFactory.create({ emailAddressVerifiedAt: new Date() });
      await ModelHasRole.create({
        modelId: user.id,
        roleId: adminRole.id,
        modelType: User.LARAVEL_TYPE
      } as ModelHasRole);
      mockUserId(user.id);
      mockPermissions("users-manage");
      await expectCan(service, "approveReject", org);
    });

    it("allows approveReject for framework admins", async () => {
      const org = await OrganisationFactory.create();
      mockUserId(123);
      mockPermissions("framework-ppc");
      await expectCan(service, "approveReject", org);
    });

    it("disallows approveReject for admin users without email verification", async () => {
      const org = await OrganisationFactory.create();
      const adminRole = await RoleFactory.create({ name: "admin-terrafund" });
      const user = await UserFactory.create({ emailAddressVerifiedAt: null });
      await ModelHasRole.create({
        modelId: user.id,
        roleId: adminRole.id,
        modelType: User.LARAVEL_TYPE
      } as ModelHasRole);
      mockUserId(user.id);
      mockPermissions("users-manage");
      await expectCannot(service, "approveReject", org);
    });

    it("disallows approveReject for users without admin role", async () => {
      const org = await OrganisationFactory.create();
      const user = await UserFactory.create({ emailAddressVerifiedAt: new Date() });
      mockUserId(user.id);
      mockPermissions("manage-own");
      await expectCannot(service, "approveReject", org);
    });

    it("disallows approveReject for regular users", async () => {
      const org = await OrganisationFactory.create();
      const user = await UserFactory.create({ organisationId: org.id });
      mockUserId(user.id);
      mockPermissions("manage-own");
      await expectCannot(service, "approveReject", org);
    });

    it("allows approveReject for admin-ppc role with email verified", async () => {
      const org = await OrganisationFactory.create();
      const adminRole = await RoleFactory.create({ name: "admin-ppc" });
      const user = await UserFactory.create({ emailAddressVerifiedAt: new Date() });
      await ModelHasRole.create({
        modelId: user.id,
        roleId: adminRole.id,
        modelType: User.LARAVEL_TYPE
      } as ModelHasRole);
      mockUserId(user.id);
      mockPermissions("users-manage");
      await expectCan(service, "approveReject", org);
    });

    it("allows approveReject for admin-terrafund role with email verified", async () => {
      const org = await OrganisationFactory.create();
      const adminRole = await RoleFactory.create({ name: "admin-terrafund" });
      const user = await UserFactory.create({ emailAddressVerifiedAt: new Date() });
      await ModelHasRole.create({
        modelId: user.id,
        roleId: adminRole.id,
        modelType: User.LARAVEL_TYPE
      } as ModelHasRole);
      mockUserId(user.id);
      mockPermissions("users-manage");
      await expectCan(service, "approveReject", org);
    });
  });

  describe("joinRequest", () => {
    it("allows joinRequest for regular users", async () => {
      const org = await OrganisationFactory.create();
      const user = await UserFactory.create();
      mockUserId(user.id);
      mockPermissions();
      await expectCan(service, "joinRequest", org);
    });

    it("denies joinRequest for greenhouse-service-account", async () => {
      const org = await OrganisationFactory.create();
      const serviceRole = await RoleFactory.create({ name: "greenhouse-service-account" });
      const user = await UserFactory.create();
      await ModelHasRole.create({
        modelId: user.id,
        roleId: serviceRole.id,
        modelType: User.LARAVEL_TYPE
      } as ModelHasRole);
      mockUserId(user.id);
      mockPermissions();
      await expectCannot(service, "joinRequest", org);
    });
  });
});

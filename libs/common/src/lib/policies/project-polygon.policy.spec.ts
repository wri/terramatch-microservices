import { PolicyService } from "./policy.service";
import { Test, TestingModule } from "@nestjs/testing";
import { expectCan, expectCannot, mockPermissions, mockUserId } from "./policy.service.spec";
import { ProjectPolygon } from "@terramatch-microservices/database/entities";
import {
  ProjectPolygonFactory,
  ProjectPitchFactory,
  FundingProgrammeFactory,
  UserFactory,
  OrganisationFactory
} from "@terramatch-microservices/database/factories";

describe("ProjectPolygonPolicy", () => {
  let service: PolicyService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PolicyService]
    }).compile();

    service = await module.resolve<PolicyService>(PolicyService);
  });

  afterEach(async () => {
    jest.restoreAllMocks();
  });

  describe("polygons-manage permission (Admin)", () => {
    it("should allow admins to read, create, update and delete all project polygons", async () => {
      const user = await UserFactory.create();
      mockUserId(user.id);
      mockPermissions("polygons-manage");

      const projectPolygon = await ProjectPolygonFactory.build();

      await expectCan(service, "read", projectPolygon);
      await expectCan(service, "create", projectPolygon);
      await expectCan(service, "update", projectPolygon);
      await expectCan(service, "delete", projectPolygon);
    });
  });

  describe("framework permission", () => {
    it("should allow framework managers to read and create project polygons in their framework", async () => {
      const user = await UserFactory.create();
      const fundingProgramme = await FundingProgrammeFactory.create({ frameworkKey: "ppc" });
      const projectPitch = await ProjectPitchFactory.create({ fundingProgrammeId: fundingProgramme.uuid });
      const projectPolygon = await ProjectPolygonFactory.build({
        entityType: ProjectPolygon.LARAVEL_TYPE_PROJECT_PITCH,
        entityId: projectPitch.id
      });

      mockUserId(user.id);
      mockPermissions("framework-ppc");

      await expectCan(service, "read", projectPolygon);
      await expectCan(service, "create", projectPolygon);
    });

    it("should not allow framework managers to update or delete project polygons", async () => {
      const user = await UserFactory.create();
      const fundingProgramme = await FundingProgrammeFactory.create({ frameworkKey: "ppc" });
      const projectPitch = await ProjectPitchFactory.create({ fundingProgrammeId: fundingProgramme.uuid });
      const projectPolygon = await ProjectPolygonFactory.build({
        entityType: ProjectPolygon.LARAVEL_TYPE_PROJECT_PITCH,
        entityId: projectPitch.id
      });

      mockUserId(user.id);
      mockPermissions("framework-ppc");

      await expectCannot(service, "update", projectPolygon);
      await expectCannot(service, "delete", projectPolygon);
    });

    it("should not allow access to project polygons outside their framework", async () => {
      const user = await UserFactory.create();
      const fundingProgramme = await FundingProgrammeFactory.create({ frameworkKey: "terrafund" });
      const projectPitch = await ProjectPitchFactory.create({ fundingProgrammeId: fundingProgramme.uuid });
      const projectPolygon = await ProjectPolygonFactory.build({
        entityType: ProjectPolygon.LARAVEL_TYPE_PROJECT_PITCH,
        entityId: projectPitch.id
      });

      mockUserId(user.id);
      mockPermissions("framework-ppc");

      await expectCannot(service, "read", projectPolygon);
      await expectCannot(service, "create", projectPolygon);
    });

    it("should handle multiple frameworks", async () => {
      const user = await UserFactory.create();
      const fundingProgramme1 = await FundingProgrammeFactory.create({ frameworkKey: "ppc" });
      const fundingProgramme2 = await FundingProgrammeFactory.create({ frameworkKey: "terrafund" });
      const projectPitch1 = await ProjectPitchFactory.create({ fundingProgrammeId: fundingProgramme1.uuid });
      const projectPitch2 = await ProjectPitchFactory.create({ fundingProgrammeId: fundingProgramme2.uuid });

      const projectPolygon1 = await ProjectPolygonFactory.build({
        entityType: ProjectPolygon.LARAVEL_TYPE_PROJECT_PITCH,
        entityId: projectPitch1.id
      });
      const projectPolygon2 = await ProjectPolygonFactory.build({
        entityType: ProjectPolygon.LARAVEL_TYPE_PROJECT_PITCH,
        entityId: projectPitch2.id
      });

      mockUserId(user.id);
      mockPermissions("framework-ppc", "framework-terrafund");

      await expectCan(service, "read", projectPolygon1);
      await expectCan(service, "read", projectPolygon2);
    });
  });

  describe("manage-own permission (Organization members)", () => {
    it("should allow organization members to read, create, update and delete their organization's project polygons", async () => {
      const organisation = await OrganisationFactory.create();
      const user = await UserFactory.create({ organisationId: organisation.id });
      const projectPitch = await ProjectPitchFactory.create({ organisationId: organisation.uuid });
      const projectPolygon = await ProjectPolygonFactory.build({
        entityType: ProjectPolygon.LARAVEL_TYPE_PROJECT_PITCH,
        entityId: projectPitch.id
      });

      mockUserId(user.id);
      mockPermissions("manage-own");

      await expectCan(service, "read", projectPolygon);
      await expectCan(service, "create", projectPolygon);
      await expectCan(service, "update", projectPolygon);
      await expectCan(service, "delete", projectPolygon);
    });

    it("should not allow access to project polygons from other organizations", async () => {
      const organisation1 = await OrganisationFactory.create();
      const organisation2 = await OrganisationFactory.create();
      const user = await UserFactory.create({ organisationId: organisation1.id });
      const projectPitch = await ProjectPitchFactory.create({ organisationId: organisation2.uuid });
      const projectPolygon = await ProjectPolygonFactory.build({
        entityType: ProjectPolygon.LARAVEL_TYPE_PROJECT_PITCH,
        entityId: projectPitch.id
      });

      mockUserId(user.id);
      mockPermissions("manage-own");

      await expectCannot(service, "read", projectPolygon);
      await expectCannot(service, "create", projectPolygon);
    });

    it("should handle users without an organization", async () => {
      const user = await UserFactory.create({ organisationId: null });
      const projectPolygon = await ProjectPolygonFactory.build();

      mockUserId(user.id);
      mockPermissions("manage-own");

      await expectCannot(service, "read", projectPolygon);
    });
  });

  describe("combined permissions", () => {
    it("should combine framework and manage-own permissions", async () => {
      const organisation = await OrganisationFactory.create();
      const user = await UserFactory.create({ organisationId: organisation.id });
      const fundingProgramme = await FundingProgrammeFactory.create({ frameworkKey: "ppc" });

      const ownOrgProjectPitch = await ProjectPitchFactory.create({ organisationId: organisation.uuid });
      const frameworkProjectPitch = await ProjectPitchFactory.create({ fundingProgrammeId: fundingProgramme.uuid });

      const ownOrgPolygon = await ProjectPolygonFactory.build({
        entityType: ProjectPolygon.LARAVEL_TYPE_PROJECT_PITCH,
        entityId: ownOrgProjectPitch.id
      });
      const frameworkPolygon = await ProjectPolygonFactory.build({
        entityType: ProjectPolygon.LARAVEL_TYPE_PROJECT_PITCH,
        entityId: frameworkProjectPitch.id
      });

      mockUserId(user.id);
      mockPermissions("manage-own", "framework-ppc");

      // Can fully manage own org polygons
      await expectCan(service, "read", ownOrgPolygon);
      await expectCan(service, "update", ownOrgPolygon);
      await expectCan(service, "delete", ownOrgPolygon);

      // Can only read and create framework polygons
      await expectCan(service, "read", frameworkPolygon);
      await expectCan(service, "create", frameworkPolygon);
    });
  });

  describe("no permissions", () => {
    it("should deny all operations when user has no permissions", async () => {
      const user = await UserFactory.create();
      const projectPolygon = await ProjectPolygonFactory.build();

      mockUserId(user.id);
      mockPermissions();

      await expectCannot(service, "read", projectPolygon);
      await expectCannot(service, "create", projectPolygon);
      await expectCannot(service, "update", projectPolygon);
      await expectCannot(service, "delete", projectPolygon);
    });
  });
});

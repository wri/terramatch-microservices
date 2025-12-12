import { PolicyService } from "./policy.service";
import { Test, TestingModule } from "@nestjs/testing";
import { expectCan, expectCannot, mockPermissions, mockUserId } from "./policy.service.spec";
import { SitePolygon } from "@terramatch-microservices/database/entities";
import {
  SiteFactory,
  ProjectFactory,
  ProjectUserFactory,
  UserFactory
} from "@terramatch-microservices/database/factories";

describe("SitePolygonPolicy", () => {
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

  it("allows service accounts with polygons-manage to read and create any polygon", async () => {
    const user = await UserFactory.create();
    mockUserId(user.id);
    mockPermissions("polygons-manage");

    const sitePolygon = new SitePolygon();
    sitePolygon.createdBy = 999; // Different user

    await expectCan(service, "read", sitePolygon);
    await expectCan(service, "create", sitePolygon);
  });

  it("allows service accounts with polygons-manage to update and delete only their own polygons", async () => {
    const user = await UserFactory.create();
    mockUserId(user.id);
    mockPermissions("polygons-manage");

    const ownPolygon = new SitePolygon();
    ownPolygon.createdBy = user.id;

    const otherPolygon = new SitePolygon();
    otherPolygon.createdBy = 999;

    await expectCan(service, "update", ownPolygon);
    await expectCan(service, "delete", ownPolygon);
    await expectCannot(service, "update", otherPolygon);
    await expectCannot(service, "delete", otherPolygon);
  });

  it("allows managing polygons within frameworks", async () => {
    const site = await SiteFactory.create({ frameworkKey: "ppc" });

    mockUserId(123);
    mockPermissions("framework-ppc");
    const sitePolygon = new SitePolygon();
    sitePolygon.siteUuid = site.uuid;

    await expectCan(service, "manage", sitePolygon);
  });

  it("allows managing polygons for own projects with manage-own", async () => {
    const user = await UserFactory.create();
    const project = await ProjectFactory.create();
    await ProjectUserFactory.create({ userId: user.id, projectId: project.id });
    const site = await SiteFactory.create({ projectId: project.id });

    mockUserId(user.id);
    mockPermissions("manage-own");
    const sitePolygon = new SitePolygon();
    sitePolygon.siteUuid = site.uuid;

    await expectCan(service, "manage", sitePolygon);
  });

  it("allows managing polygons for managed projects with projects-manage", async () => {
    const user = await UserFactory.create();
    const project = await ProjectFactory.create();
    await ProjectUserFactory.create({ userId: user.id, projectId: project.id, isManaging: true });
    const site = await SiteFactory.create({ projectId: project.id });

    mockUserId(user.id);
    mockPermissions("projects-manage");
    const sitePolygon = new SitePolygon();
    sitePolygon.siteUuid = site.uuid;

    await expectCan(service, "manage", sitePolygon);
  });

  it("disallows managing polygons for non-managed projects with projects-manage", async () => {
    const user = await UserFactory.create();
    const project = await ProjectFactory.create();
    await ProjectUserFactory.create({ userId: user.id, projectId: project.id, isManaging: false });
    const site = await SiteFactory.create({ projectId: project.id });

    mockUserId(user.id);
    mockPermissions("projects-manage");
    const sitePolygon = new SitePolygon();
    sitePolygon.siteUuid = site.uuid;

    await expectCannot(service, "manage", sitePolygon);
  });

  it("disallows reading polygons without polygons-manage", async () => {
    mockUserId(123);
    mockPermissions();
    await expectCannot(service, "readAll", SitePolygon);
  });

  it("allows deleting polygons within frameworks", async () => {
    const site = await SiteFactory.create({ frameworkKey: "ppc" });

    mockUserId(123);
    mockPermissions("framework-ppc");
    const sitePolygon = new SitePolygon();
    sitePolygon.siteUuid = site.uuid;

    await expectCan(service, "delete", sitePolygon);
  });

  it("allows deleting polygons for own projects with manage-own", async () => {
    const user = await UserFactory.create();
    const project = await ProjectFactory.create();
    await ProjectUserFactory.create({ userId: user.id, projectId: project.id });
    const site = await SiteFactory.create({ projectId: project.id });

    mockUserId(user.id);
    mockPermissions("manage-own");
    const sitePolygon = new SitePolygon();
    sitePolygon.siteUuid = site.uuid;

    await expectCan(service, "delete", sitePolygon);
  });

  it("allows deleting polygons for managed projects with projects-manage", async () => {
    const user = await UserFactory.create();
    const project = await ProjectFactory.create();
    await ProjectUserFactory.create({ userId: user.id, projectId: project.id, isManaging: true });
    const site = await SiteFactory.create({ projectId: project.id });

    mockUserId(user.id);
    mockPermissions("projects-manage");
    const sitePolygon = new SitePolygon();
    sitePolygon.siteUuid = site.uuid;

    await expectCan(service, "delete", sitePolygon);
  });

  it("disallows deleting polygons without appropriate permissions", async () => {
    const site = await SiteFactory.create({ frameworkKey: "ppc" });
    const sitePolygon = new SitePolygon();
    sitePolygon.siteUuid = site.uuid;

    mockUserId(123);
    mockPermissions();

    await expectCannot(service, "delete", sitePolygon);
  });

  describe("service accounts with polygons-manage", () => {
    it("allows service accounts to delete their own site polygons", async () => {
      const user = await UserFactory.create();
      const site = await SiteFactory.create();

      mockUserId(user.id);
      mockPermissions("polygons-manage");

      const sitePolygon = new SitePolygon();
      sitePolygon.siteUuid = site.uuid;
      sitePolygon.createdBy = user.id;

      await expectCan(service, "delete", sitePolygon);
    });

    it("blocks service accounts from deleting other users' site polygons", async () => {
      const user = await UserFactory.create();
      const site = await SiteFactory.create();

      mockUserId(user.id);
      mockPermissions("polygons-manage");

      const sitePolygon = new SitePolygon();
      sitePolygon.siteUuid = site.uuid;
      sitePolygon.createdBy = 999; // Different user

      await expectCannot(service, "delete", sitePolygon);
    });

    it("allows service accounts to read site polygons", async () => {
      const user = await UserFactory.create();
      const site = await SiteFactory.create();

      mockUserId(user.id);
      mockPermissions("polygons-manage");

      const sitePolygon = new SitePolygon();
      sitePolygon.siteUuid = site.uuid;

      await expectCan(service, "read", sitePolygon);
    });
  });
});

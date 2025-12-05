import { PolicyService } from "./policy.service";
import { Test, TestingModule } from "@nestjs/testing";
import { expectCan, expectCannot } from "./policy.service.spec";
import { SitePolygon } from "@terramatch-microservices/database/entities";
import {
  SiteFactory,
  ProjectFactory,
  ProjectUserFactory,
  UserFactory
} from "@terramatch-microservices/database/factories";
import { mockPermissions, mockUserId } from "../util/testing";

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

  it("allows managing any polygon with polygons-manage", async () => {
    mockUserId(123);
    mockPermissions("polygons-manage");
    await expectCan(service, "manage", SitePolygon);
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
});

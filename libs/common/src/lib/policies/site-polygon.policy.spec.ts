import { PolicyService } from "./policy.service";
import { Test, TestingModule } from "@nestjs/testing";
import { expectCan, expectCannot, mockPermissions, mockUserId } from "./policy.service.spec";
import { SitePolygon } from "@terramatch-microservices/database/entities";
import {
  SiteFactory,
  ProjectFactory,
  UserFactory,
  ProjectUserFactory
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
    const user = await UserFactory.create({ id: 123 });
    const project = await ProjectFactory.create();
    await ProjectUserFactory.create({ userId: 123, projectId: project.id });
    const site = await SiteFactory.create({ projectId: project.id });

    mockUserId(123);
    mockPermissions("manage-own");
    const sitePolygon = new SitePolygon();
    sitePolygon.siteUuid = site.uuid;

    await expectCan(service, "manage", sitePolygon);
  });

  it("allows managing polygons for managed projects with projects-manage", async () => {
    const user = await UserFactory.create({ id: 123 });
    const project = await ProjectFactory.create();
    await ProjectUserFactory.create({ userId: 123, projectId: project.id, isManaging: true });
    const site = await SiteFactory.create({ projectId: project.id });

    mockUserId(123);
    mockPermissions("projects-manage");
    const sitePolygon = new SitePolygon();
    sitePolygon.siteUuid = site.uuid;

    await expectCan(service, "manage", sitePolygon);
  });

  it("disallows managing polygons for non-managed projects with projects-manage", async () => {
    const project = await ProjectFactory.create();
    await ProjectUserFactory.create({ userId: 123, projectId: project.id, isManaging: false });
    const site = await SiteFactory.create({ projectId: project.id });

    mockUserId(123);
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
});

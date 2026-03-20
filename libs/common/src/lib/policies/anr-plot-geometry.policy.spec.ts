import { PolicyService } from "./policy.service";
import { Test, TestingModule } from "@nestjs/testing";
import { expectCan, expectCannot } from "./policy.service.spec";
import { AnrPlotGeometry } from "@terramatch-microservices/database/entities";
import {
  ProjectFactory,
  ProjectUserFactory,
  SiteFactory,
  SitePolygonFactory,
  UserFactory
} from "@terramatch-microservices/database/factories";
import { mockPermissions, mockUserId } from "../util/testing";

describe("AnrPlotGeometryPolicy", () => {
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

  describe("polygons-manage permission", () => {
    it("allows service accounts with polygons-manage to read and create any anr plot geometry", async () => {
      const user = await UserFactory.create();
      mockUserId(user.id);
      mockPermissions("polygons-manage");

      const anrPlotGeometry = new AnrPlotGeometry();
      anrPlotGeometry.createdBy = user.id + 1;

      await expectCan(service, "read", anrPlotGeometry);
      await expectCan(service, "create", anrPlotGeometry);
    });

    it("allows service accounts with polygons-manage to update and delete only their own anr plot geometries", async () => {
      const user = await UserFactory.create();
      mockUserId(user.id);
      mockPermissions("polygons-manage");

      const ownPlotGeometry = new AnrPlotGeometry();
      ownPlotGeometry.createdBy = user.id;

      const otherPlotGeometry = new AnrPlotGeometry();
      otherPlotGeometry.createdBy = user.id + 1;

      await expectCan(service, "update", ownPlotGeometry);
      await expectCan(service, "delete", ownPlotGeometry);
      await expectCannot(service, "update", otherPlotGeometry);
      await expectCannot(service, "delete", otherPlotGeometry);
    });
  });

  describe("scoped access", () => {
    it("allows managing anr plot geometries within frameworks", async () => {
      const site = await SiteFactory.create({ frameworkKey: "ppc" });
      const sitePolygon = await SitePolygonFactory.create({ siteUuid: site.uuid });

      mockUserId(123);
      mockPermissions("framework-ppc");
      const anrPlotGeometry = new AnrPlotGeometry();
      anrPlotGeometry.sitePolygonUuid = sitePolygon.uuid;

      await expectCan(service, "manage", anrPlotGeometry);
    });

    it("allows managing anr plot geometries for own projects with manage-own", async () => {
      const user = await UserFactory.create();
      const project = await ProjectFactory.create();
      await ProjectUserFactory.create({ userId: user.id, projectId: project.id });
      const site = await SiteFactory.create({ projectId: project.id });
      const sitePolygon = await SitePolygonFactory.create({ siteUuid: site.uuid });

      mockUserId(user.id);
      mockPermissions("manage-own");
      const anrPlotGeometry = new AnrPlotGeometry();
      anrPlotGeometry.sitePolygonUuid = sitePolygon.uuid;

      await expectCan(service, "manage", anrPlotGeometry);
    });

    it("allows managing anr plot geometries for managed projects with projects-manage", async () => {
      const user = await UserFactory.create();
      const project = await ProjectFactory.create();
      await ProjectUserFactory.create({ userId: user.id, projectId: project.id, isManaging: true });
      const site = await SiteFactory.create({ projectId: project.id });
      const sitePolygon = await SitePolygonFactory.create({ siteUuid: site.uuid });

      mockUserId(user.id);
      mockPermissions("projects-manage");
      const anrPlotGeometry = new AnrPlotGeometry();
      anrPlotGeometry.sitePolygonUuid = sitePolygon.uuid;

      await expectCan(service, "manage", anrPlotGeometry);
    });

    it("disallows managing anr plot geometries for non-managed projects with projects-manage", async () => {
      const user = await UserFactory.create();
      const project = await ProjectFactory.create();
      await ProjectUserFactory.create({ userId: user.id, projectId: project.id, isManaging: false });
      const site = await SiteFactory.create({ projectId: project.id });
      const sitePolygon = await SitePolygonFactory.create({ siteUuid: site.uuid });

      mockUserId(user.id);
      mockPermissions("projects-manage");
      const anrPlotGeometry = new AnrPlotGeometry();
      anrPlotGeometry.sitePolygonUuid = sitePolygon.uuid;

      await expectCannot(service, "manage", anrPlotGeometry);
    });
  });

  describe("read-only permissions", () => {
    it("allows reading with view-dashboard permission", async () => {
      const user = await UserFactory.create();
      mockUserId(user.id);
      mockPermissions("view-dashboard");

      const anrPlotGeometry = new AnrPlotGeometry();

      await expectCan(service, "read", anrPlotGeometry);
      await expectCannot(service, "create", anrPlotGeometry);
      await expectCannot(service, "update", anrPlotGeometry);
      await expectCannot(service, "delete", anrPlotGeometry);
    });

    it("allows reading with projects-read permission", async () => {
      const user = await UserFactory.create();
      mockUserId(user.id);
      mockPermissions("projects-read");

      const anrPlotGeometry = new AnrPlotGeometry();

      await expectCan(service, "read", anrPlotGeometry);
      await expectCannot(service, "create", anrPlotGeometry);
      await expectCannot(service, "update", anrPlotGeometry);
      await expectCannot(service, "delete", anrPlotGeometry);
    });
  });

  describe("no permissions", () => {
    it("denies all operations when user has no permissions", async () => {
      const user = await UserFactory.create();
      mockUserId(user.id);
      mockPermissions();

      const anrPlotGeometry = new AnrPlotGeometry();

      await expectCannot(service, "read", anrPlotGeometry);
      await expectCannot(service, "create", anrPlotGeometry);
      await expectCannot(service, "update", anrPlotGeometry);
      await expectCannot(service, "delete", anrPlotGeometry);
    });
  });
});

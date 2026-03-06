import { PolicyService } from "./policy.service";
import { Test, TestingModule } from "@nestjs/testing";
import { expectCan, expectCannot } from "./policy.service.spec";
import { AnrPlotGeometry } from "@terramatch-microservices/database/entities";
import { UserFactory } from "@terramatch-microservices/database/factories";
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
    it("should allow admins to read, create, update and delete all anr plot geometries", async () => {
      const user = await UserFactory.create();
      mockUserId(user.id);
      mockPermissions("polygons-manage");

      const anrPlotGeometry = new AnrPlotGeometry();

      await expectCan(service, "read", anrPlotGeometry);
      await expectCan(service, "create", anrPlotGeometry);
      await expectCan(service, "update", anrPlotGeometry);
      await expectCan(service, "delete", anrPlotGeometry);
    });
  });

  describe("read-only permissions", () => {
    it("should allow reading with view-dashboard permission", async () => {
      const user = await UserFactory.create();
      mockUserId(user.id);
      mockPermissions("view-dashboard");

      const anrPlotGeometry = new AnrPlotGeometry();

      await expectCan(service, "read", anrPlotGeometry);
      await expectCannot(service, "create", anrPlotGeometry);
      await expectCannot(service, "update", anrPlotGeometry);
      await expectCannot(service, "delete", anrPlotGeometry);
    });

    it("should allow reading with projects-read permission", async () => {
      const user = await UserFactory.create();
      mockUserId(user.id);
      mockPermissions("projects-read");

      const anrPlotGeometry = new AnrPlotGeometry();

      await expectCan(service, "read", anrPlotGeometry);
      await expectCannot(service, "create", anrPlotGeometry);
      await expectCannot(service, "update", anrPlotGeometry);
      await expectCannot(service, "delete", anrPlotGeometry);
    });

    it("should allow reading with manage-own permission", async () => {
      const user = await UserFactory.create();
      mockUserId(user.id);
      mockPermissions("manage-own");

      const anrPlotGeometry = new AnrPlotGeometry();

      await expectCan(service, "read", anrPlotGeometry);
      await expectCannot(service, "create", anrPlotGeometry);
      await expectCannot(service, "update", anrPlotGeometry);
      await expectCannot(service, "delete", anrPlotGeometry);
    });

    it("should allow reading with projects-manage permission", async () => {
      const user = await UserFactory.create();
      mockUserId(user.id);
      mockPermissions("projects-manage");

      const anrPlotGeometry = new AnrPlotGeometry();

      await expectCan(service, "read", anrPlotGeometry);
      await expectCannot(service, "create", anrPlotGeometry);
      await expectCannot(service, "update", anrPlotGeometry);
      await expectCannot(service, "delete", anrPlotGeometry);
    });
  });

  describe("no permissions", () => {
    it("should deny all operations when user has no permissions", async () => {
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

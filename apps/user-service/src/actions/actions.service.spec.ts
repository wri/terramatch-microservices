import { Test, TestingModule } from "@nestjs/testing";
import { ActionsService } from "./actions.service";
import { Action, ProjectReport, Site, SiteReport, Nursery } from "@terramatch-microservices/database/entities";
import {
  ProjectFactory,
  ProjectReportFactory,
  ProjectUserFactory,
  SiteFactory,
  SiteReportFactory,
  NurseryFactory,
  UserFactory
} from "@terramatch-microservices/database/factories";
import { ActionFactory } from "@terramatch-microservices/database/factories/action.factory";

describe("ActionsService", () => {
  let service: ActionsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ActionsService]
    }).compile();

    service = module.get<ActionsService>(ActionsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("getActions", () => {
    it("should return empty array when user has no projects", async () => {
      const user = await UserFactory.create();

      const result = await service.getActions(user.id);

      expect(result).toEqual([]);
    });

    it("should throw error when user not found", async () => {
      await expect(service.getActions(99999)).rejects.toThrow("User not found");
    });

    it("should return actions for project reports with due status", async () => {
      const user = await UserFactory.create();
      const project = await ProjectFactory.create();
      await ProjectUserFactory.create({ userId: user.id, projectId: project.id });

      const projectReport = await ProjectReportFactory.create({
        projectId: project.id,
        status: "due"
      });

      const action = await (
        Action.build({
          projectId: project.id,
          targetableType: ProjectReport.LARAVEL_TYPE,
          targetableId: projectReport.id,
          status: "pending"
        } as unknown as Action) as Action
      ).save();

      const result = await service.getActions(user.id);

      expect(result.length).toBeGreaterThan(0);
      expect(result.some(d => d.action.id === action.id)).toBe(true);
    });

    it("should return actions for site reports with needs-more-information status", async () => {
      const user = await UserFactory.create();
      const project = await ProjectFactory.create();
      await ProjectUserFactory.create({ userId: user.id, projectId: project.id });

      const site = await SiteFactory.create({ projectId: project.id });
      const siteReport = await SiteReportFactory.create({
        siteId: site.id,
        status: "needs-more-information"
      });

      const action = await (
        Action.build({
          projectId: project.id,
          targetableType: SiteReport.LARAVEL_TYPE,
          targetableId: siteReport.id,
          status: "pending"
        } as unknown as Action) as Action
      ).save();

      const result = await service.getActions(user.id);

      expect(result.length).toBeGreaterThan(0);
      expect(result.some(d => d.action.id === action.id)).toBe(true);
    });

    it("should return actions for projects with needs-more-information status", async () => {
      const user = await UserFactory.create();
      const project = await ProjectFactory.create({ status: "needs-more-information" });
      await ProjectUserFactory.create({ userId: user.id, projectId: project.id });

      const action = await ActionFactory.forProject.create({
        projectId: project.id,
        targetableId: project.id,
        status: "pending"
      });

      const result = await service.getActions(user.id);

      expect(result.length).toBeGreaterThan(0);
      expect(result.some(d => d.action.id === action.id)).toBe(true);
    });

    it("should return actions for sites with needs-more-information status", async () => {
      const user = await UserFactory.create();
      const project = await ProjectFactory.create();
      await ProjectUserFactory.create({ userId: user.id, projectId: project.id });

      const site = await SiteFactory.create({ projectId: project.id, status: "needs-more-information" });

      const action = await (
        Action.build({
          projectId: project.id,
          targetableType: Site.LARAVEL_TYPE,
          targetableId: site.id,
          status: "pending"
        } as unknown as Action) as Action
      ).save();

      const result = await service.getActions(user.id);

      expect(result.length).toBeGreaterThan(0);
      expect(result.some(d => d.action.id === action.id)).toBe(true);
    });

    it("should return actions for nurseries with needs-more-information status", async () => {
      const user = await UserFactory.create();
      const project = await ProjectFactory.create();
      await ProjectUserFactory.create({ userId: user.id, projectId: project.id });

      const nursery = await NurseryFactory.create({ projectId: project.id, status: "needs-more-information" });

      const action = await (
        Action.build({
          projectId: project.id,
          targetableType: Nursery.LARAVEL_TYPE,
          targetableId: nursery.id,
          status: "pending"
        } as unknown as Action) as Action
      ).save();

      const result = await service.getActions(user.id);

      expect(result.length).toBeGreaterThan(0);
      expect(result.some(d => d.action.id === action.id)).toBe(true);
    });

    it("should not return actions for non-pending status", async () => {
      const user = await UserFactory.create();
      const project = await ProjectFactory.create();
      await ProjectUserFactory.create({ userId: user.id, projectId: project.id });

      const projectReport = await ProjectReportFactory.create({
        projectId: project.id,
        status: "due"
      });

      await (
        Action.build({
          projectId: project.id,
          targetableType: ProjectReport.LARAVEL_TYPE,
          targetableId: projectReport.id,
          status: "completed"
        } as unknown as Action) as Action
      ).save();

      const result = await service.getActions(user.id);

      expect(result.every(d => d.action.status === "pending")).toBe(true);
    });

    it("should not return actions for reports with non-matching status", async () => {
      const user = await UserFactory.create();
      const project = await ProjectFactory.create();
      await ProjectUserFactory.create({ userId: user.id, projectId: project.id });

      const projectReport = await ProjectReportFactory.create({
        projectId: project.id,
        status: "approved"
      });

      await (
        Action.build({
          projectId: project.id,
          targetableType: ProjectReport.LARAVEL_TYPE,
          targetableId: projectReport.id,
          status: "pending"
        } as unknown as Action) as Action
      ).save();

      const result = await service.getActions(user.id);

      expect(result.every(d => d.action.targetableId !== projectReport.id)).toBe(true);
    });

    it("should return target with correct type for project reports", async () => {
      const user = await UserFactory.create();
      const project = await ProjectFactory.create();
      await ProjectUserFactory.create({ userId: user.id, projectId: project.id });

      const projectReport = await ProjectReportFactory.create({
        projectId: project.id,
        status: "due"
      });

      const action = await (
        Action.build({
          projectId: project.id,
          targetableType: ProjectReport.LARAVEL_TYPE,
          targetableId: projectReport.id,
          status: "pending"
        } as unknown as Action) as Action
      ).save();

      const result = await service.getActions(user.id);

      const actionData = result.find(d => d.action.id === action.id);
      expect(actionData).toBeDefined();
      expect(actionData?.targetableType).toBe("projectReports");
      expect(actionData?.target).toBeDefined();
    });

    it("should return target with correct type for sites", async () => {
      const user = await UserFactory.create();
      const project = await ProjectFactory.create();
      await ProjectUserFactory.create({ userId: user.id, projectId: project.id });

      const site = await SiteFactory.create({ projectId: project.id, status: "needs-more-information" });

      const action = await (
        Action.build({
          projectId: project.id,
          targetableType: Site.LARAVEL_TYPE,
          targetableId: site.id,
          status: "pending"
        } as unknown as Action) as Action
      ).save();

      const result = await service.getActions(user.id);

      const actionData = result.find(d => d.action.id === action.id);
      expect(actionData).toBeDefined();
      expect(actionData?.targetableType).toBe("sites");
      expect(actionData?.target).toBeDefined();
    });
  });
});

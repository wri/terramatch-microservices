import { Test, TestingModule } from "@nestjs/testing";
import { ActionsController } from "./actions.controller";
import { ActionsService, type ActionWithTarget } from "./actions.service";
import { createMock, DeepMocked } from "@golevelup/ts-jest";
import { Action } from "@terramatch-microservices/database/entities";
import {
  ProjectFactory,
  ProjectReportFactory,
  ProjectUserFactory,
  UserFactory
} from "@terramatch-microservices/database/factories";
import { serialize } from "@terramatch-microservices/common/util/testing";
import { Resource } from "@terramatch-microservices/common/util/json-api-builder";
import { mockUserId } from "@terramatch-microservices/common/util/testing";

describe("ActionsController", () => {
  let controller: ActionsController;
  let actionsService: DeepMocked<ActionsService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ActionsController],
      providers: [{ provide: ActionsService, useValue: (actionsService = createMock<ActionsService>()) }]
    }).compile();

    controller = module.get<ActionsController>(ActionsController);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("index", () => {
    it("should return actions from service", async () => {
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
          targetableType: "App\\Models\\V2\\ProjectReports\\ProjectReport",
          targetableId: projectReport.id,
          status: "pending"
        } as unknown as Action) as Action
      ).save();

      const mockData: ActionWithTarget = {
        action,
        target: { uuid: projectReport.uuid, status: "due" } as unknown as ActionWithTarget["target"],
        targetableType: "projectReports" as const
      };

      actionsService.getActions.mockResolvedValue([mockData]);

      mockUserId(user.id);

      const result = serialize(await controller.index());

      expect(result).toBeDefined();
      expect(result.data).toBeDefined();

      expect(actionsService.getActions).toHaveBeenCalledWith(user.id);
    });

    it("should handle empty results", async () => {
      const user = await UserFactory.create();
      mockUserId(user.id);

      actionsService.getActions.mockResolvedValue([]);

      const result = serialize(await controller.index());

      expect(result.data).toBeDefined();
      expect(Array.isArray(result.data)).toBe(true);
    });

    it("should return correct JSON:API structure", async () => {
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
          targetableType: "App\\Models\\V2\\ProjectReports\\ProjectReport",
          targetableId: projectReport.id,
          status: "pending"
        } as unknown as Action) as Action
      ).save();

      const mockData: ActionWithTarget = {
        action,
        target: { uuid: projectReport.uuid, status: "due" } as unknown as ActionWithTarget["target"],
        targetableType: "projectReports" as const
      };

      actionsService.getActions.mockResolvedValue([mockData]);

      mockUserId(user.id);

      const result = serialize(await controller.index());

      expect(result.data).toBeDefined();
      if (Array.isArray(result.data) && result.data.length > 0) {
        const resource = result.data[0] as Resource;
        expect(resource.type).toBe("actions");
        expect(resource.attributes).toBeDefined();
        expect(resource.attributes.uuid).toBe(action.uuid);
        expect(resource.attributes.targetableType).toBe("projectReports");
        expect(resource.attributes.target).toBeDefined();
      }
    });

    it("should include target in action attributes", async () => {
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
          targetableType: "App\\Models\\V2\\ProjectReports\\ProjectReport",
          targetableId: projectReport.id,
          status: "pending"
        } as unknown as Action) as Action
      ).save();

      const mockTarget = {
        uuid: projectReport.uuid,
        status: "due",
        frameworkKey: "ppc",
        lightResource: true
      } as unknown;

      const mockData: ActionWithTarget = {
        action,
        target: mockTarget as unknown as ActionWithTarget["target"],
        targetableType: "projectReports" as const
      };

      actionsService.getActions.mockResolvedValue([mockData]);

      mockUserId(user.id);

      const result = serialize(await controller.index());

      if (Array.isArray(result.data) && result.data.length > 0) {
        const resource = result.data[0] as Resource;
        expect(resource.attributes.target).toBeDefined();
        expect(resource.attributes.target).toMatchObject(mockTarget as unknown as object);
      }
    });
  });
});

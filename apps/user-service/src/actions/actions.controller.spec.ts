import { Test, TestingModule } from "@nestjs/testing";
import { ActionsController } from "./actions.controller";
import { ActionsService, type ActionWithTarget } from "./actions.service";
import { createMock, DeepMocked } from "@golevelup/ts-jest";
import { IndexQueryDto } from "@terramatch-microservices/common/dto/index-query.dto";
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

  describe("indexMyActions", () => {
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

      actionsService.getMyActions.mockResolvedValue({
        data: [mockData],
        paginationTotal: 1,
        pageNumber: 1
      });

      mockUserId(user.id);

      const query: IndexQueryDto = { page: { number: 1, size: 10 } };
      const result = serialize(await controller.indexMyActions(query));

      expect(result).toBeDefined();
      expect(result.data).toBeDefined();
      expect(result.meta).toBeDefined();
      expect(result.meta.indices?.[0].total).toBe(1);
      expect(result.meta.indices?.[0].pageNumber).toBe(1);

      expect(actionsService.getMyActions).toHaveBeenCalledWith(user.id, query);
    });

    it("should handle empty results", async () => {
      const user = await UserFactory.create();
      mockUserId(user.id);

      actionsService.getMyActions.mockResolvedValue({
        data: [],
        paginationTotal: 0,
        pageNumber: 1
      });

      const query: IndexQueryDto = { page: { number: 1, size: 10 } };
      const result = serialize(await controller.indexMyActions(query));

      expect(result.data).toBeDefined();
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.meta.indices?.[0].total).toBe(0);
      expect(result.meta.indices?.[0].pageNumber).toBe(1);
    });

    it("should throw error when user ID not found", async () => {
      // Mock authenticatedUserId to return undefined
      mockUserId(undefined);

      const query: IndexQueryDto = { page: { number: 1, size: 10 } };

      await expect(controller.indexMyActions(query)).rejects.toThrow("User ID not found in request context");
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

      actionsService.getMyActions.mockResolvedValue({
        data: [mockData],
        paginationTotal: 1,
        pageNumber: 1
      });

      mockUserId(user.id);

      const query: IndexQueryDto = { page: { number: 1, size: 10 } };
      const result = serialize(await controller.indexMyActions(query));

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

    it("should handle pagination metadata correctly", async () => {
      const user = await UserFactory.create();
      mockUserId(user.id);

      actionsService.getMyActions.mockResolvedValue({
        data: [],
        paginationTotal: 15,
        pageNumber: 2
      });

      const query: IndexQueryDto = { page: { number: 2, size: 10 } };
      const result = serialize(await controller.indexMyActions(query));

      expect(result.meta.indices?.[0].total).toBe(15);
      expect(result.meta.indices?.[0].pageNumber).toBe(2);
      expect(result.meta.indices?.[0].requestPath).toContain("page%5Bnumber%5D=2");
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

      actionsService.getMyActions.mockResolvedValue({
        data: [mockData],
        paginationTotal: 1,
        pageNumber: 1
      });

      mockUserId(user.id);

      const query: IndexQueryDto = { page: { number: 1, size: 10 } };
      const result = serialize(await controller.indexMyActions(query));

      if (Array.isArray(result.data) && result.data.length > 0) {
        const resource = result.data[0] as Resource;
        expect(resource.attributes.target).toBeDefined();
        expect(resource.attributes.target).toMatchObject(mockTarget as unknown as object);
      }
    });
  });
});

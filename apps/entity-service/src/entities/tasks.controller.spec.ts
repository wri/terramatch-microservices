import { createMock, DeepMocked } from "@golevelup/ts-jest";
import { PolicyService } from "@terramatch-microservices/common";
import { Test } from "@nestjs/testing";
import { TasksService } from "./tasks.service";
import { TasksController } from "./tasks.controller";
import { TaskQueryDto } from "./dto/task-query.dto";
import { TaskFactory } from "@terramatch-microservices/database/factories";
import { Task } from "@terramatch-microservices/database/entities";
import { BadRequestException } from "@nestjs/common";
import { Resource } from "@terramatch-microservices/common/util";
import { TaskLightDto } from "./dto/task.dto";

describe("TasksController", () => {
  let controller: TasksController;
  let service: DeepMocked<TasksService>;
  let policyService: DeepMocked<PolicyService>;

  beforeEach(async () => {
    await Task.truncate();

    const module = await Test.createTestingModule({
      controllers: [TasksController],
      providers: [
        { provide: TasksService, useValue: (service = createMock<TasksService>()) },
        { provide: PolicyService, useValue: (policyService = createMock<PolicyService>({ userId: 123 })) }
      ]
    }).compile();

    controller = module.get(TasksController);
    service = module.get(TasksService);

    // Mock addFullTaskDto to add data to the document for each task
    service.addFullTaskDto.mockImplementation(async (document, task) => {
      document.addData(task.uuid, new TaskLightDto(task));
      return document;
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("taskIndex", () => {
    it("should call getTasks", async () => {
      policyService.getPermissions.mockResolvedValue(["framework-ppc"]);
      const query: TaskQueryDto = { page: { number: 2 }, sort: { field: "projectName" }, status: "approved" };
      await controller.taskIndex(query);
      expect(service.getTasks).toHaveBeenCalledWith(query);
    });

    it("should add DTOs to the document", async () => {
      const tasks = await TaskFactory.createMany(2);
      service.getTasks.mockResolvedValue({ tasks, total: tasks.length });
      policyService.authorize.mockResolvedValue();

      const result = await controller.taskIndex({});
      expect(policyService.authorize).toHaveBeenCalledWith("read", tasks);
      expect(result.meta.indices?.[0]?.pageNumber).toBe(1);
      expect(result.meta.indices?.[0]?.total).toBe(2);
      expect(result.meta.resourceType).toBe("tasks");
      expect(result.data).toHaveLength(2);
      expect((result.data as Resource[])[0].attributes.lightResource).toBe(true);
    });
  });

  describe("taskGet", () => {
    it("should return the full dto", async () => {
      const task = await TaskFactory.create();
      service.getTask.mockResolvedValue(task);
      policyService.authorize.mockResolvedValue();
      await controller.taskGet({ uuid: task.uuid });
      expect(policyService.authorize).toHaveBeenCalledWith("read", task);
      expect(service.addFullTaskDto).toHaveBeenCalledWith(expect.anything(), task);
    });
  });

  describe("taskUpdate", () => {
    it("should throw if the path id and updated object id don't match", async () => {
      await expect(
        controller.taskUpdate({ uuid: "jedi" }, { data: { type: "tasks", id: "sith", attributes: {} } })
      ).rejects.toThrow(BadRequestException);
    });

    it("should throw if the status is not awaiting-approval", async () => {
      const task = await TaskFactory.create();
      service.getTask.mockResolvedValue(task);
      policyService.authorize.mockResolvedValue();
      await expect(
        controller.taskUpdate(
          { uuid: task.uuid },
          { data: { type: "tasks", id: task.uuid, attributes: { status: "approved" } } }
        )
      ).rejects.toThrow(BadRequestException);
    });

    it("should update the status, save the task and add the full dto", async () => {
      const task = await TaskFactory.create();
      service.getTask.mockResolvedValue(task);
      policyService.authorize.mockResolvedValue();
      const spy = jest.spyOn(task, "save");
      await controller.taskUpdate(
        { uuid: task.uuid },
        { data: { type: "tasks", id: task.uuid, attributes: { status: "awaiting-approval" } } }
      );
      expect(policyService.authorize).toHaveBeenCalledWith("update", task);
      expect(service.submitForApproval).toHaveBeenCalledWith(task);
      expect(spy).toHaveBeenCalled();
      expect(service.addFullTaskDto).toHaveBeenCalledWith(expect.anything(), task);
    });
  });
});

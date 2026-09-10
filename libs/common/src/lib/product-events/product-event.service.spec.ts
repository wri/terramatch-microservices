import { ProjectFactory, TaskFactory } from "@terramatch-microservices/database/factories";
import { ProductEventService } from "./product-event.service";
import { Test, TestingModule } from "@nestjs/testing";
import { createMock, DeepMocked } from "@golevelup/ts-jest";
import { getQueueToken } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { DateTime } from "luxon";

describe("ProductEventService", () => {
  let module: TestingModule;
  let service: ProductEventService;
  let emailQueue: DeepMocked<Queue>;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      providers: [
        ProductEventService,
        { provide: getQueueToken("email"), useValue: (emailQueue = createMock<Queue>()) }
      ]
    }).compile();

    service = module.get(ProductEventService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("taskCreated", () => {
    it("should queue report reminder emails when a TF report-reminder framework task is created", async () => {
      const project = await ProjectFactory.create({ frameworkKey: "terrafund-landscapes" });
      const dueAt = DateTime.utc(2027, 1, 31).toJSDate();
      const task = await TaskFactory.create({ projectId: project.id, dueAt });

      await service.taskCreated(task);

      expect(emailQueue.add).toHaveBeenCalledWith(
        "terrafundReportReminder",
        expect.objectContaining({ projectIds: [project.id], dueAt: dueAt.toISOString() })
      );
    });
  });
});

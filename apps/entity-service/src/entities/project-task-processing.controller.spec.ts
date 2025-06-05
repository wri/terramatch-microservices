import { Test, TestingModule } from "@nestjs/testing";
import { ProjectTaskProcessingController } from "./project-task-processing.controller";
import { ProjectTaskProcessingService } from "./project-task-processing.service";
import { createMock, DeepMocked } from "@golevelup/ts-jest";
import { NotFoundException } from "@nestjs/common";
import { ReportType } from "./dto/project-task-processing.dto";

describe("ProjectTaskProcessingController", () => {
  let controller: ProjectTaskProcessingController;
  let service: DeepMocked<ProjectTaskProcessingService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProjectTaskProcessingController],
      providers: [
        {
          provide: ProjectTaskProcessingService,
          useValue: (service = createMock<ProjectTaskProcessingService>())
        }
      ]
    }).compile();

    controller = module.get<ProjectTaskProcessingController>(ProjectTaskProcessingController);
  });

  describe("processProjectTasks", () => {
    it("should return project tasks and reports for a valid project UUID", async () => {
      const mockResponse = {
        projectUuid: "test-uuid",
        projectName: "Test Project",
        reports: [
          {
            uuid: "report-uuid",
            name: "Test Report",
            type: ReportType.SITE_REPORT,
            submittedAt: new Date(),
            taskUuid: "task-uuid",
            nothingToReport: true
          }
        ]
      };

      service.processProjectTasks.mockResolvedValue(mockResponse);

      const result = await controller.processProjectTasks("test-uuid");

      expect(result).toEqual(mockResponse);
      expect(service.processProjectTasks).toHaveBeenCalledWith("test-uuid");
    });

    it("should propagate NotFoundException from service", async () => {
      service.processProjectTasks.mockRejectedValue(new NotFoundException());

      await expect(controller.processProjectTasks("non-existent-uuid")).rejects.toThrow(NotFoundException);
    });
  });

  describe("approveReports", () => {
    it("should approve reports and return success message", async () => {
      const mockResponse = {
        approvedCount: 2,
        message: "Successfully approved 2 reports"
      };

      service.approveReports.mockResolvedValue(mockResponse);

      const result = await controller.approveReports({
        reportUuids: ["report1-uuid", "report2-uuid"]
      });

      expect(result).toEqual(mockResponse);
      expect(service.approveReports).toHaveBeenCalledWith(["report1-uuid", "report2-uuid"]);
    });

    it("should handle empty report UUIDs array", async () => {
      const mockResponse = {
        approvedCount: 0,
        message: "Successfully approved 0 reports"
      };

      service.approveReports.mockResolvedValue(mockResponse);

      const result = await controller.approveReports({
        reportUuids: []
      });

      expect(result).toEqual(mockResponse);
      expect(service.approveReports).toHaveBeenCalledWith([]);
    });
  });
});

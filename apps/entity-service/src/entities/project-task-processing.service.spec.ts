import { Test, TestingModule } from "@nestjs/testing";
import { ProjectTaskProcessingService } from "./project-task-processing.service";
import { PolicyService } from "@terramatch-microservices/common";
import { Project, Task } from "@terramatch-microservices/database/entities";
import { createMock } from "@golevelup/ts-jest";
import { NotFoundException } from "@nestjs/common";

describe("ProjectTaskProcessingService", () => {
  let service: ProjectTaskProcessingService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectTaskProcessingService,
        {
          provide: PolicyService,
          useValue: createMock<PolicyService>()
        }
      ]
    }).compile();

    service = module.get<ProjectTaskProcessingService>(ProjectTaskProcessingService);
  });

  describe("processProjectTasks", () => {
    it("should throw NotFoundException when project is not found", async () => {
      jest.spyOn(Project, "findOne").mockResolvedValue(null);
      await expect(service.processProjectTasks("non-existent-uuid")).rejects.toThrow(NotFoundException);
    });

    it("should process tasks and return reports for a valid project", async () => {
      const mockProject = {
        id: 1,
        uuid: "test-uuid",
        name: "Test Project"
      } as Project;

      const mockTask = {
        uuid: "task-uuid",
        siteReports: [
          {
            uuid: "site-report-uuid",
            title: "Site Report",
            submittedAt: new Date(),
            nothingToReport: true,
            site: { name: "Test Site" }
          }
        ],
        nurseryReports: [
          {
            uuid: "nursery-report-uuid",
            title: "Nursery Report",
            submittedAt: new Date(),
            nothingToReport: true,
            nursery: { name: "Test Nursery" }
          }
        ]
      } as Task;

      jest.spyOn(Project, "findOne").mockResolvedValue(mockProject);
      jest.spyOn(Task, "findAll").mockResolvedValue([mockTask]);

      const result = await service.processProjectTasks("test-uuid");

      expect(result).toEqual({
        projectUuid: "test-uuid",
        projectName: "Test Project",
        reports: expect.arrayContaining([
          expect.objectContaining({
            uuid: "site-report-uuid",
            type: "siteReport",
            nothingToReport: true
          }),
          expect.objectContaining({
            uuid: "nursery-report-uuid",
            type: "nurseryReport",
            nothingToReport: true
          })
        ])
      });
    });
  });
});

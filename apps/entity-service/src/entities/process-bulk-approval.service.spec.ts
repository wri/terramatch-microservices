import { Test, TestingModule } from "@nestjs/testing";
import { ProcessBulkApprovalService } from "./process-bulk-approval.service";
import { PolicyService } from "@terramatch-microservices/common";
import { Project, Task } from "@terramatch-microservices/database/entities";
import { createMock } from "@golevelup/ts-jest";
import { NotFoundException } from "@nestjs/common";
import { APPROVED } from "@terramatch-microservices/database/constants/status";

describe("ProcessBulkApprovalService", () => {
  let service: ProcessBulkApprovalService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProcessBulkApprovalService,
        {
          provide: PolicyService,
          useValue: createMock<PolicyService>()
        }
      ]
    }).compile();

    service = module.get<ProcessBulkApprovalService>(ProcessBulkApprovalService);
  });

  describe("processbulkApproval", () => {
    it("should throw NotFoundException when project is not found", async () => {
      jest.spyOn(Project, "findOne").mockResolvedValue(null);
      await expect(service.processbulkApproval("non-existent-uuid")).rejects.toThrow(NotFoundException);
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

      const result = await service.processbulkApproval("test-uuid");

      expect(result).toEqual({
        projectUuid: "test-uuid",
        reportsBulkApproval: [
          {
            uuid: "site-report-uuid",
            name: "Site Report",
            type: "siteReport",
            nothingToReport: true,
            submittedAt: expect.any(Date),
            status: undefined
          },
          {
            uuid: "nursery-report-uuid",
            name: "Nursery Report",
            type: "nurseryReport",
            nothingToReport: true,
            submittedAt: expect.any(Date),
            status: undefined
          }
        ]
      });
    });
  });
});

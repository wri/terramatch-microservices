import { createMock, DeepMocked } from "@golevelup/ts-jest";
import { Test } from "@nestjs/testing";
import { NotFoundException, UnauthorizedException } from "@nestjs/common";
import { PolicyService } from "@terramatch-microservices/common";
import { Project, Site } from "@terramatch-microservices/database/entities";
import { AggregateReportsController } from "./aggregate-reports.controller";
import { AggregateReportsService } from "./aggregate-reports.service";
import { AggregateReportsResponseDto } from "./dto/aggregate-reports-response.dto";

describe("AggregateReportsController", () => {
  let controller: AggregateReportsController;
  let aggregateReportsService: DeepMocked<AggregateReportsService>;
  let policyService: DeepMocked<PolicyService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [AggregateReportsController],
      providers: [
        {
          provide: AggregateReportsService,
          useValue: (aggregateReportsService = createMock<AggregateReportsService>())
        },
        { provide: PolicyService, useValue: (policyService = createMock<PolicyService>()) }
      ]
    }).compile();

    controller = module.get(AggregateReportsController);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("getAggregateReports", () => {
    it("throws NotFoundException when entity is not found", async () => {
      jest.spyOn(Project, "findOne").mockResolvedValue(null);

      await expect(
        controller.getAggregateReports({ entity: "projects", uuid: "00000000-0000-0000-0000-000000000000" })
      ).rejects.toThrow(NotFoundException);
    });

    it("throws UnauthorizedException when user is not authorized", async () => {
      const project = createMock<Project>({ id: 1, uuid: "project-uuid", frameworkKey: "terrafund" });
      jest.spyOn(Project, "findOne").mockResolvedValue(project);
      policyService.authorize.mockRejectedValue(new UnauthorizedException());

      await expect(controller.getAggregateReports({ entity: "projects", uuid: project.uuid })).rejects.toThrow(
        UnauthorizedException
      );
    });

    it("returns aggregate reports for a project", async () => {
      const project = createMock<Project>({ id: 1, uuid: "project-uuid", frameworkKey: "terrafund" });
      jest.spyOn(Project, "findOne").mockResolvedValue(project);

      const stubResponse: AggregateReportsResponseDto = {
        "tree-planted": [{ dueDate: "2024-06-30T00:00:00.000Z", aggregateAmount: 100 }],
        "trees-regenerating": [{ dueDate: "2024-06-30T00:00:00.000Z", aggregateAmount: 50 }]
      };
      aggregateReportsService.getAggregateReports.mockResolvedValue(stubResponse);

      const result = await controller.getAggregateReports({ entity: "projects", uuid: project.uuid });

      expect(policyService.authorize).toHaveBeenCalledWith("read", project);
      expect(aggregateReportsService.getAggregateReports).toHaveBeenCalledWith("projects", project);
      expect(result).toEqual(stubResponse);
    });

    it("returns aggregate reports for a site", async () => {
      const site = createMock<Site>({ id: 1, uuid: "site-uuid", frameworkKey: "ppc" });
      jest.spyOn(Site, "findOne").mockResolvedValue(site);

      const stubResponse: AggregateReportsResponseDto = {
        "tree-planted": [],
        "seeding-records": [],
        "trees-regenerating": []
      };
      aggregateReportsService.getAggregateReports.mockResolvedValue(stubResponse);

      const result = await controller.getAggregateReports({ entity: "sites", uuid: site.uuid });

      expect(policyService.authorize).toHaveBeenCalledWith("read", site);
      expect(aggregateReportsService.getAggregateReports).toHaveBeenCalledWith("sites", site);
      expect(result).toEqual(stubResponse);
    });
  });
});

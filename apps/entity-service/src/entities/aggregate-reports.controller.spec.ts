import { createMock, DeepMocked } from "@golevelup/ts-jest";
import { Test } from "@nestjs/testing";
import { BadRequestException, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { PolicyService } from "@terramatch-microservices/common";
import { Resource } from "@terramatch-microservices/common/util";
import { Project, Site } from "@terramatch-microservices/database/entities";
import { AggregateReportsController } from "./aggregate-reports.controller";
import { AggregateReportsService } from "./aggregate-reports.service";
import { AggregateReportsResponseDto } from "./dto/aggregate-reports-response.dto";
import { serialize } from "@terramatch-microservices/common/util/testing";

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

    it("returns JSON:API document with aggregateReports resource and camelCase attributes for a project", async () => {
      const project = createMock<Project>({ id: 1, uuid: "project-uuid", frameworkKey: "terrafund" });
      jest.spyOn(Project, "findOne").mockResolvedValue(project);

      const stubAttributes: AggregateReportsResponseDto = {
        treePlanted: [{ dueDate: "2024-06-30T00:00:00.000Z", aggregateAmount: 100 }],
        treesRegenerating: [{ dueDate: "2024-06-30T00:00:00.000Z", aggregateAmount: 50 }]
      };
      aggregateReportsService.getAggregateReports.mockResolvedValue(stubAttributes);

      const result = await controller.getAggregateReports({ entity: "projects", uuid: project.uuid });
      const serialized = serialize(result);

      expect(policyService.authorize).toHaveBeenCalledWith("read", project);
      expect(aggregateReportsService.getAggregateReports).toHaveBeenCalledWith("projects", project);
      const resource = serialized.data as Resource;
      expect(resource.type).toBe("aggregateReports");
      expect(resource.id).toBe("projects|project-uuid");
      expect(resource.attributes).toBeDefined();
      expect(resource.attributes.treePlanted).toEqual(stubAttributes.treePlanted);
      expect(resource.attributes.treesRegenerating).toEqual(stubAttributes.treesRegenerating);
      expect(resource.attributes.seedingRecords).toBeUndefined();
    });

    it("returns JSON:API document for a site with all three series when framework is ppc", async () => {
      const site = createMock<Site>({ id: 1, uuid: "site-uuid", frameworkKey: "ppc" });
      jest.spyOn(Site, "findOne").mockResolvedValue(site);

      const stubAttributes: AggregateReportsResponseDto = {
        treePlanted: [],
        seedingRecords: [],
        treesRegenerating: []
      };
      aggregateReportsService.getAggregateReports.mockResolvedValue(stubAttributes);

      const result = await controller.getAggregateReports({ entity: "sites", uuid: site.uuid });
      const serialized = serialize(result);

      expect(policyService.authorize).toHaveBeenCalledWith("read", site);
      expect(aggregateReportsService.getAggregateReports).toHaveBeenCalledWith("sites", site);
      const resource = serialized.data as Resource;
      expect(resource.type).toBe("aggregateReports");
      expect(resource.id).toBe("sites|site-uuid");
      expect(resource.attributes.treePlanted).toEqual([]);
      expect(resource.attributes.seedingRecords).toEqual([]);
      expect(resource.attributes.treesRegenerating).toEqual([]);
    });

    it("propagates BadRequestException from service (e.g. unsupported framework)", async () => {
      const { BadRequestException } = await import("@nestjs/common");
      const project = createMock<Project>({ id: 1, uuid: "project-uuid", frameworkKey: "epa-ghana-pilot" });
      jest.spyOn(Project, "findOne").mockResolvedValue(project);
      aggregateReportsService.getAggregateReports.mockRejectedValue(
        new BadRequestException("Unsupported framework for aggregate reports: epa-ghana-pilot")
      );

      await expect(controller.getAggregateReports({ entity: "projects", uuid: project.uuid })).rejects.toThrow(
        BadRequestException
      );
    });

    it("throws BadRequestException when entity type is not supported (not in ENTITY_MODELS)", async () => {
      await expect(
        controller.getAggregateReports({
          entity: "other" as "projects",
          uuid: "00000000-0000-0000-0000-000000000000"
        })
      ).rejects.toThrow(BadRequestException);
      await expect(
        controller.getAggregateReports({
          entity: "other" as "projects",
          uuid: "00000000-0000-0000-0000-000000000000"
        })
      ).rejects.toThrow("Unsupported entity type");
    });
  });
});

import { createMock, DeepMocked } from "@golevelup/ts-jest";
import { UnauthorizedException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { PolicyService } from "@terramatch-microservices/common";
import { getStableRequestQuery } from "@terramatch-microservices/common/util";
import { serialize } from "@terramatch-microservices/common/util/testing";
import { SitePolygon } from "@terramatch-microservices/database/entities";
import { ProjectFilterOptionsDto } from "./dto/project-filter-options.dto";
import { ProjectFilterOptionsService } from "./project-filter-options.service";
import { ProjectMapIndexDto } from "./dto/project-map-index.dto";
import { ProjectMapIndexService } from "./project-map-index.service";
import { ProjectsController } from "./projects.controller";

describe("ProjectsController", () => {
  let controller: ProjectsController;
  let service: DeepMocked<ProjectMapIndexService>;
  let filterOptionsService: DeepMocked<ProjectFilterOptionsService>;
  let policyService: DeepMocked<PolicyService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [ProjectsController],
      providers: [
        { provide: ProjectMapIndexService, useValue: (service = createMock()) },
        { provide: ProjectFilterOptionsService, useValue: (filterOptionsService = createMock()) },
        { provide: PolicyService, useValue: (policyService = createMock<PolicyService>({ permissions: [] })) }
      ]
    }).compile();

    controller = module.get(ProjectsController);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("mapIndex", () => {
    it("passes the user's framework scope to the service", async () => {
      const scopedPolicyService = createMock<PolicyService>({ permissions: ["framework-ppc", "projects-manage"] });
      scopedPolicyService.authorize.mockResolvedValue(undefined);
      const scopedService = createMock<ProjectMapIndexService>();
      scopedService.getMapIndex.mockResolvedValue(new ProjectMapIndexDto([]));
      const module = await Test.createTestingModule({
        controllers: [ProjectsController],
        providers: [
          { provide: ProjectMapIndexService, useValue: scopedService },
          { provide: ProjectFilterOptionsService, useValue: createMock<ProjectFilterOptionsService>() },
          { provide: PolicyService, useValue: scopedPolicyService }
        ]
      }).compile();

      await module.get(ProjectsController).mapIndex({});

      expect(scopedService.getMapIndex).toHaveBeenCalledWith({}, ["ppc"]);
    });

    it("authorizes before querying", async () => {
      policyService.authorize.mockRejectedValue(new UnauthorizedException());

      await expect(controller.mapIndex({})).rejects.toThrow(UnauthorizedException);
      expect(policyService.authorize).toHaveBeenCalledWith("read", SitePolygon);
      expect(service.getMapIndex).not.toHaveBeenCalled();
    });

    it("returns the map index keyed by the stable request query", async () => {
      policyService.authorize.mockResolvedValue(undefined);
      const query = { frameworkKey: ["ppc" as const], country: ["KE"] };
      const entry = {
        uuid: "project-uuid",
        name: "Project",
        lat: 1,
        long: 2,
        frameworkKey: "ppc" as const,
        level0Project: ["KE"],
        cohort: "terrafund",
        polygonCount: 3,
        sumNumTrees: 1200,
        sumCalcArea: 4.5,
        latestQaCycle: 2,
        latestQaStatus: "qa-in-progress" as const
      };
      service.getMapIndex.mockResolvedValue(new ProjectMapIndexDto([entry]));

      const result = serialize(await controller.mapIndex(query));

      expect(service.getMapIndex).toHaveBeenCalledWith(query, null);
      expect(result.data).toMatchObject({
        id: getStableRequestQuery(query),
        type: "projectMapIndexes",
        attributes: { projects: [entry], total: 1 }
      });
    });
  });

  describe("filterOptions", () => {
    const emptyOptions = new ProjectFilterOptionsDto({
      organisations: [],
      frameworkKeys: [],
      countries: [],
      projects: []
    });

    it("passes the user's framework scope and the query to the service", async () => {
      const scopedPolicyService = createMock<PolicyService>({ permissions: ["framework-hbf", "projects-manage"] });
      scopedPolicyService.authorize.mockResolvedValue(undefined);
      const scopedFilterService = createMock<ProjectFilterOptionsService>();
      scopedFilterService.getFilterOptions.mockResolvedValue(emptyOptions);
      const module = await Test.createTestingModule({
        controllers: [ProjectsController],
        providers: [
          { provide: ProjectMapIndexService, useValue: createMock<ProjectMapIndexService>() },
          { provide: ProjectFilterOptionsService, useValue: scopedFilterService },
          { provide: PolicyService, useValue: scopedPolicyService }
        ]
      }).compile();

      await module.get(ProjectsController).filterOptions({ organisationSearch: "acme" });

      expect(scopedFilterService.getFilterOptions).toHaveBeenCalledWith({ organisationSearch: "acme" }, ["hbf"]);
    });

    it("authorizes before querying", async () => {
      policyService.authorize.mockRejectedValue(new UnauthorizedException());

      await expect(controller.filterOptions({})).rejects.toThrow(UnauthorizedException);
      expect(policyService.authorize).toHaveBeenCalledWith("read", SitePolygon);
      expect(filterOptionsService.getFilterOptions).not.toHaveBeenCalled();
    });

    it("returns the options as a projectFilterOptions resource keyed by the stable request query", async () => {
      policyService.authorize.mockResolvedValue(undefined);
      const query = { organisationUuid: ["org-uuid"], projectSearch: "wom" };
      const options = new ProjectFilterOptionsDto({
        organisations: [{ uuid: "org-uuid", name: "Org", count: 2 }],
        frameworkKeys: [{ value: "ppc", count: 2 }],
        countries: [{ value: "KE", count: 2 }],
        projects: [{ uuid: "project-uuid", name: "Wombat" }]
      });
      filterOptionsService.getFilterOptions.mockResolvedValue(options);

      const result = serialize(await controller.filterOptions(query));

      expect(filterOptionsService.getFilterOptions).toHaveBeenCalledWith(query, null);
      expect(result.data).toMatchObject({
        id: getStableRequestQuery(query),
        type: "projectFilterOptions",
        attributes: {
          organisations: options.organisations,
          frameworkKeys: options.frameworkKeys,
          countries: options.countries,
          projects: options.projects
        }
      });
    });
  });
});

import { createMock, DeepMocked } from "@golevelup/ts-jest";
import { UnauthorizedException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { PolicyService } from "@terramatch-microservices/common";
import { getStableRequestQuery } from "@terramatch-microservices/common/util";
import { serialize } from "@terramatch-microservices/common/util/testing";
import { SitePolygon } from "@terramatch-microservices/database/entities";
import { ProjectMapIndexDto } from "./dto/project-map-index.dto";
import { ProjectMapIndexService } from "./project-map-index.service";
import { ProjectsController } from "./projects.controller";

describe("ProjectsController", () => {
  let controller: ProjectsController;
  let service: DeepMocked<ProjectMapIndexService>;
  let policyService: DeepMocked<PolicyService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [ProjectsController],
      providers: [
        { provide: ProjectMapIndexService, useValue: (service = createMock()) },
        { provide: PolicyService, useValue: (policyService = createMock()) }
      ]
    }).compile();

    controller = module.get(ProjectsController);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("mapIndex", () => {
    it("authorizes before querying", async () => {
      policyService.authorize.mockRejectedValue(new UnauthorizedException());

      await expect(controller.mapIndex({})).rejects.toThrow(UnauthorizedException);
      expect(policyService.authorize).toHaveBeenCalledWith("read", SitePolygon);
      expect(service.getMapIndex).not.toHaveBeenCalled();
    });

    it("returns the map index keyed by the stable request query", async () => {
      policyService.authorize.mockResolvedValue(undefined);
      const query = { frameworkKey: ["ppc" as const], country: ["KE"] };
      const entry = { uuid: "project-uuid", name: "Project", lat: 1, long: 2 };
      service.getMapIndex.mockResolvedValue(new ProjectMapIndexDto([entry]));

      const result = serialize(await controller.mapIndex(query));

      expect(service.getMapIndex).toHaveBeenCalledWith(query);
      expect(result.data).toMatchObject({
        id: getStableRequestQuery(query),
        type: "projectMapIndexes",
        attributes: { projects: [entry], total: 1 }
      });
    });
  });
});

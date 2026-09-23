import { createMock, DeepMocked } from "@golevelup/ts-jest";
import { UnauthorizedException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { PolicyService } from "@terramatch-microservices/common";
import { serialize } from "@terramatch-microservices/common/util/testing";
import { ResearchTreeCount } from "@terramatch-microservices/database/entities";
import { ProjectFactory, ResearchTreeCountFactory } from "@terramatch-microservices/database/factories";
import { ResearchTreeCountWithProject } from "./dto/research-tree-count.dto";
import { ResearchTreeCountsController } from "./research-tree-counts.controller";
import { ResearchTreeCountsService } from "./research-tree-counts.service";

describe("ResearchTreeCountsController", () => {
  let controller: ResearchTreeCountsController;
  let service: DeepMocked<ResearchTreeCountsService>;
  let policyService: DeepMocked<PolicyService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [ResearchTreeCountsController],
      providers: [
        { provide: ResearchTreeCountsService, useValue: (service = createMock()) },
        { provide: PolicyService, useValue: (policyService = createMock()) }
      ]
    }).compile();

    controller = module.get(ResearchTreeCountsController);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("index", () => {
    it("authorizes before querying", async () => {
      policyService.authorize.mockRejectedValue(new UnauthorizedException());

      await expect(controller.index({})).rejects.toThrow(UnauthorizedException);
      expect(policyService.authorize).toHaveBeenCalledWith("read", ResearchTreeCount);
      expect(service.addIndex).not.toHaveBeenCalled();
    });

    it("delegates to the service when authorized", async () => {
      policyService.authorize.mockResolvedValue(undefined);
      const query = { page: { after: "f47ac10b-58cc-4372-a567-0e02b2c3d479" } };

      await controller.index(query);

      expect(service.addIndex).toHaveBeenCalledWith(expect.anything(), query);
    });
  });

  describe("get", () => {
    const createTreeCount = async () => {
      const project = await ProjectFactory.create();
      const treeCount = await ResearchTreeCountFactory.create({ projectId: project.id });
      return { project, treeCount: Object.assign(treeCount, { project }) as ResearchTreeCountWithProject };
    };

    it("throws if the user may not read the tree count", async () => {
      const { project, treeCount } = await createTreeCount();
      service.findByProjectUuid.mockResolvedValue(treeCount);
      policyService.authorize.mockRejectedValue(new UnauthorizedException());

      await expect(controller.get(project.uuid)).rejects.toThrow(UnauthorizedException);
      expect(policyService.authorize).toHaveBeenCalledWith("read", treeCount);
    });

    it("returns the tree count for the project", async () => {
      const { project, treeCount } = await createTreeCount();
      service.findByProjectUuid.mockResolvedValue(treeCount);
      policyService.authorize.mockResolvedValue(undefined);

      const result = serialize(await controller.get(project.uuid));

      expect(service.findByProjectUuid).toHaveBeenCalledWith(project.uuid);
      expect(result.data).toMatchObject({
        id: project.uuid,
        type: "researchTreeCounts",
        attributes: { projectUuid: project.uuid, treeCountAdj: treeCount.treeCountAdj }
      });
    });
  });
});

import { createMock, DeepMocked } from "@golevelup/ts-jest";
import { BadRequestException, UnauthorizedException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { PolicyService } from "@terramatch-microservices/common";
import { serialize } from "@terramatch-microservices/common/util/testing";
import { ResearchTreeCount } from "@terramatch-microservices/database/entities";
import { ProjectFactory, ResearchTreeCountFactory } from "@terramatch-microservices/database/factories";
import { CreateResearchTreeCountBody, ResearchTreeCountWithProject } from "./dto/research-tree-count.dto";
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

  const createTreeCount = async () => {
    const project = await ProjectFactory.create();
    const treeCount = await ResearchTreeCountFactory.create({ projectId: project.id });
    return { project, treeCount: Object.assign(treeCount, { project }) as ResearchTreeCountWithProject };
  };

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

  describe("create", () => {
    const payload: CreateResearchTreeCountBody = {
      data: {
        type: "researchTreeCounts",
        attributes: {
          projectUuid: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
          verificationMethod: "remote",
          reportedCount: 10,
          treeCountAdj: 9,
          upperBounds: 11,
          lowerBounds: 8
        }
      }
    };

    it("authorizes before creating", async () => {
      policyService.authorize.mockRejectedValue(new UnauthorizedException());

      await expect(controller.create(payload)).rejects.toThrow(UnauthorizedException);
      expect(policyService.authorize).toHaveBeenCalledWith("create", ResearchTreeCount);
      expect(service.create).not.toHaveBeenCalled();
    });

    it("returns the created tree count", async () => {
      const { project, treeCount } = await createTreeCount();
      service.create.mockResolvedValue(treeCount);
      policyService.authorize.mockResolvedValue(undefined);

      const result = serialize(await controller.create(payload));

      expect(service.create).toHaveBeenCalledWith(payload.data.attributes);
      expect(result.data).toMatchObject({ id: project.uuid, type: "researchTreeCounts" });
    });
  });

  describe("update", () => {
    const payload = (id: string) => ({ data: { type: "researchTreeCounts", id, attributes: { treeCountAdj: 5 } } });

    it("throws if the path and payload ids do not match", async () => {
      const { project } = await createTreeCount();

      await expect(controller.update(project.uuid, payload("other"))).rejects.toThrow(BadRequestException);
      expect(service.update).not.toHaveBeenCalled();
    });

    it("throws if the user may not update the tree count", async () => {
      const { project, treeCount } = await createTreeCount();
      service.findByProjectUuid.mockResolvedValue(treeCount);
      policyService.authorize.mockRejectedValue(new UnauthorizedException());

      await expect(controller.update(project.uuid, payload(project.uuid))).rejects.toThrow(UnauthorizedException);
      expect(policyService.authorize).toHaveBeenCalledWith("update", treeCount);
      expect(service.update).not.toHaveBeenCalled();
    });

    it("returns the updated tree count", async () => {
      const { project, treeCount } = await createTreeCount();
      service.findByProjectUuid.mockResolvedValue(treeCount);
      service.update.mockResolvedValue(treeCount);
      policyService.authorize.mockResolvedValue(undefined);

      const result = serialize(await controller.update(project.uuid, payload(project.uuid)));

      expect(service.update).toHaveBeenCalledWith(treeCount, { treeCountAdj: 5 });
      expect(result.data).toMatchObject({ id: project.uuid, type: "researchTreeCounts" });
    });
  });

  describe("delete", () => {
    it("throws if the user may not delete the tree count", async () => {
      const { project, treeCount } = await createTreeCount();
      service.findByProjectUuid.mockResolvedValue(treeCount);
      policyService.authorize.mockRejectedValue(new UnauthorizedException());

      await expect(controller.delete(project.uuid)).rejects.toThrow(UnauthorizedException);
      expect(policyService.authorize).toHaveBeenCalledWith("delete", treeCount);
      expect(service.delete).not.toHaveBeenCalled();
    });

    it("deletes the tree count", async () => {
      const { project, treeCount } = await createTreeCount();
      service.findByProjectUuid.mockResolvedValue(treeCount);
      policyService.authorize.mockResolvedValue(undefined);

      const result = serialize(await controller.delete(project.uuid));

      expect(service.delete).toHaveBeenCalledWith(treeCount);
      expect(result.meta).toMatchObject({ resourceType: "researchTreeCounts", resourceIds: [project.uuid] });
    });
  });
});

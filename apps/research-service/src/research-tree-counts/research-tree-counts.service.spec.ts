import { BadRequestException, NotFoundException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { buildJsonApi, Resource } from "@terramatch-microservices/common/util";
import { serialize } from "@terramatch-microservices/common/util/testing";
import { Project, ResearchTreeCount } from "@terramatch-microservices/database/entities";
import { ProjectFactory, ResearchTreeCountFactory } from "@terramatch-microservices/database/factories";
import { CreateResearchTreeCountAttributes, ResearchTreeCountDto } from "./dto/research-tree-count.dto";
import { faker } from "@faker-js/faker";
import { omit } from "lodash";
import { ResearchTreeCountQueryDto } from "./dto/research-tree-count-query.dto";
import { ResearchTreeCountsService } from "./research-tree-counts.service";

describe("ResearchTreeCountsService", () => {
  let service: ResearchTreeCountsService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({ providers: [ResearchTreeCountsService] }).compile();
    service = module.get(ResearchTreeCountsService);
  });

  describe("findByProjectUuid", () => {
    it("returns the tree count for the project", async () => {
      const project = await ProjectFactory.create();
      const treeCount = await ResearchTreeCountFactory.create({ projectId: project.id });

      const result = await service.findByProjectUuid(project.uuid);

      expect(result.id).toBe(treeCount.id);
      expect(result.project.uuid).toBe(project.uuid);
    });

    it("throws when the project has no tree count", async () => {
      const project = await ProjectFactory.create();
      await expect(service.findByProjectUuid(project.uuid)).rejects.toThrow(NotFoundException);
    });
  });

  describe("addIndex", () => {
    const addIndex = async (query: ResearchTreeCountQueryDto) =>
      serialize(await service.addIndex(buildJsonApi(ResearchTreeCountDto, { pagination: "cursor" }), query));

    it("returns a page of tree counts with the pagination total", async () => {
      await ResearchTreeCountFactory.createMany(3);

      const result = await addIndex({ page: { size: 2 } });

      expect(result.data).toHaveLength(2);
      expect(result.meta.indices?.[0].total).toBe(await ResearchTreeCount.count());
      for (const resource of result.data as Resource[]) {
        const treeCount = await service.findByProjectUuid(resource.id);
        expect(resource.meta?.page?.cursor).toBe(resource.id);
        expect(resource.attributes).toMatchObject({
          projectUuid: resource.id,
          verificationMethod: treeCount.verificationMethod,
          reportedCount: treeCount.reportedCount,
          treeCountAdj: treeCount.treeCountAdj,
          upperBounds: treeCount.upperBounds,
          lowerBounds: treeCount.lowerBounds
        });
      }
    });

    it("returns the records after the page[after] project uuid", async () => {
      const [first, second] = await ResearchTreeCountFactory.createMany(2);
      const firstProject = await Project.findByPk(first.projectId, { attributes: ["uuid"] });
      const secondProject = await Project.findByPk(second.projectId, { attributes: ["uuid"] });

      const result = await addIndex({ page: { size: 1, after: firstProject?.uuid } });

      expect((result.data as Resource[]).map(({ id }) => id)).toEqual([secondProject?.uuid]);
      expect(result.meta.indices?.[0].cursor).toBe(firstProject?.uuid);
    });

    it("throws if page[after] does not match a tree count", async () => {
      const project = await ProjectFactory.create();
      await expect(addIndex({ page: { after: project.uuid } })).rejects.toThrow(BadRequestException);
    });

    it("throws for an invalid page size", async () => {
      await expect(addIndex({ page: { size: 101 } })).rejects.toThrow(BadRequestException);
    });
  });

  describe("create", () => {
    const attributes = (projectUuid: string): CreateResearchTreeCountAttributes => ({
      projectUuid,
      verificationMethod: "field",
      reportedCount: 1000,
      treeCountAdj: 900,
      upperBounds: 950,
      lowerBounds: 850
    });

    it("creates the tree count for the project", async () => {
      const project = await ProjectFactory.create();

      const treeCount = await service.create(attributes(project.uuid));

      expect(treeCount.project.uuid).toBe(project.uuid);
      const stored = await service.findByProjectUuid(project.uuid);
      expect(stored.id).toBe(treeCount.id);
      expect(stored).toMatchObject({ ...omit(attributes(project.uuid), "projectUuid"), projectId: project.id });
    });

    it("throws if the project does not exist", async () => {
      await expect(service.create(attributes(faker.string.uuid()))).rejects.toThrow(BadRequestException);
    });

    it("throws if the project already has a tree count", async () => {
      const project = await ProjectFactory.create();
      await ResearchTreeCountFactory.create({ projectId: project.id });

      await expect(service.create(attributes(project.uuid))).rejects.toThrow(BadRequestException);
    });

    it("allows creating a new tree count after the previous one was deleted", async () => {
      const project = await ProjectFactory.create();
      const deleted = await ResearchTreeCountFactory.create({ projectId: project.id });
      await deleted.destroy();

      const treeCount = await service.create(attributes(project.uuid));

      expect(treeCount.id).not.toBe(deleted.id);
      expect((await service.findByProjectUuid(project.uuid)).id).toBe(treeCount.id);
    });
  });

  describe("update", () => {
    it("updates only the provided attributes", async () => {
      const project = await ProjectFactory.create();
      const original = await ResearchTreeCountFactory.create({ projectId: project.id });
      const treeCount = await service.findByProjectUuid(project.uuid);

      await service.update(treeCount, { treeCountAdj: 42 });

      await original.reload();
      expect(original.treeCountAdj).toBe(42);
      expect(original.reportedCount).toBe(treeCount.reportedCount);
      expect(original.projectId).toBe(project.id);
    });
  });

  describe("delete", () => {
    it("soft deletes the tree count", async () => {
      const project = await ProjectFactory.create();
      const treeCount = await ResearchTreeCountFactory.create({ projectId: project.id });

      await service.delete(treeCount);

      await expect(service.findByProjectUuid(project.uuid)).rejects.toThrow(NotFoundException);
      expect((await ResearchTreeCount.findByPk(treeCount.id, { paranoid: false }))?.deletedAt).not.toBeNull();
    });
  });
});

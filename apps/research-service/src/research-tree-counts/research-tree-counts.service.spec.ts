import { BadRequestException, NotFoundException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { buildJsonApi, Resource } from "@terramatch-microservices/common/util";
import { serialize } from "@terramatch-microservices/common/util/testing";
import { Project, ResearchTreeCount } from "@terramatch-microservices/database/entities";
import {
  LandscapeGeometryFactory,
  ProjectFactory,
  ResearchTreeCountFactory
} from "@terramatch-microservices/database/factories";
import { LandscapeSlug } from "@terramatch-microservices/database/types/landscapeGeometry";
import { CreateResearchTreeCountAttributes, ResearchTreeCountDto } from "./dto/research-tree-count.dto";
import { faker } from "@faker-js/faker";
import { omit, sortBy } from "lodash";
import { ResearchTreeCountQueryDto } from "./dto/research-tree-count-query.dto";
import { ResearchTreeCountsService } from "./research-tree-counts.service";

describe("ResearchTreeCountsService", () => {
  let service: ResearchTreeCountsService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({ providers: [ResearchTreeCountsService] }).compile();
    service = module.get(ResearchTreeCountsService);
  });

  const addIndex = async (query: ResearchTreeCountQueryDto) =>
    serialize(await service.addIndex(buildJsonApi(ResearchTreeCountDto, { pagination: "cursor" }), query));

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
    it("returns a page of tree counts with the pagination total", async () => {
      await ResearchTreeCountFactory.createMany(3);

      const result = await addIndex({ page: { size: 2 } });

      expect(result.data).toHaveLength(2);
      // Tree counts for soft-deleted projects are excluded from the index.
      expect(result.meta.indices?.[0].total).toBe(
        await ResearchTreeCount.count({ include: [{ association: "project", attributes: [], required: true }] })
      );
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
      // Scope to a unique cohort so rows created concurrently by other suites can't interleave.
      const cohort = `cohort-${faker.string.alphanumeric(10)}`;
      const created = await Promise.all(
        [1, 2].map(async () => {
          const project = await ProjectFactory.create({ cohort });
          const treeCount = await ResearchTreeCountFactory.create({ projectId: project.id });
          return { project, treeCount };
        })
      );
      // The index pages in id order, and concurrent inserts don't guarantee creation order matches id order.
      const [first, second] = sortBy(created, ({ treeCount }) => treeCount.id);

      const result = await addIndex({ projectCohort: [cohort], page: { size: 1, after: first.project.uuid } });

      expect((result.data as Resource[]).map(({ id }) => id)).toEqual([second.project.uuid]);
      expect(result.meta.indices?.[0].cursor).toBe(first.project.uuid);
    });

    it("throws if page[after] does not match a tree count", async () => {
      const project = await ProjectFactory.create();
      await expect(addIndex({ page: { after: project.uuid } })).rejects.toThrow(BadRequestException);
    });

    it("throws for an invalid page size", async () => {
      await expect(addIndex({ page: { size: 101 } })).rejects.toThrow(BadRequestException);
    });
  });

  describe("addIndex filters", () => {
    const indexIds = async (query: ResearchTreeCountQueryDto) =>
      ((await addIndex(query)).data as Resource[]).map(({ id }) => id);

    const createForProject = async (projectAttributes: Partial<Project> = {}) => {
      const project = await ProjectFactory.create(projectAttributes);
      const treeCount = await ResearchTreeCountFactory.create({ projectId: project.id });
      return { project, treeCount };
    };

    it("filters by project uuid", async () => {
      const { project: a } = await createForProject();
      const { project: b } = await createForProject();
      await createForProject();

      expect((await indexIds({ projectId: [a.uuid, b.uuid] })).sort()).toEqual([a.uuid, b.uuid].sort());
    });

    it("filters by project short name", async () => {
      const shortName = `short-${faker.string.alphanumeric(10)}`;
      const { project } = await createForProject({ shortName });
      await createForProject();

      expect(await indexIds({ projectShortNames: [shortName] })).toEqual([project.uuid]);
    });

    it("filters by project cohort", async () => {
      const cohort = `cohort-${faker.string.alphanumeric(10)}`;
      const { project } = await createForProject({ cohort });
      await createForProject();

      expect(await indexIds({ projectCohort: [cohort] })).toEqual([project.uuid]);
    });

    it("filters by project landscape", async () => {
      const landscape = await LandscapeGeometryFactory.create();
      const { project } = await createForProject({ landscape: landscape.landscape });
      await createForProject();

      expect(await indexIds({ landscape: landscape.slug as LandscapeSlug })).toEqual([project.uuid]);
    });

    it("throws for an unrecognized landscape slug", async () => {
      await expect(addIndex({ landscape: "does-not-exist-slug" as LandscapeSlug })).rejects.toThrow(
        BadRequestException
      );
    });

    it("combines project filters", async () => {
      const cohort = `cohort-${faker.string.alphanumeric(10)}`;
      const { project } = await createForProject({ cohort });
      const { project: otherCohortProject } = await createForProject();

      expect(await indexIds({ projectCohort: [cohort], projectId: [project.uuid, otherCohortProject.uuid] })).toEqual([
        project.uuid
      ]);
    });

    it("filters by last modified date", async () => {
      const cohort = `cohort-${faker.string.alphanumeric(10)}`;
      const { treeCount: old } = await createForProject({ cohort });
      const { project: recent } = await createForProject({ cohort });
      // Sequelize won't write an explicit updatedAt through update(), so backdate with a raw query.
      await old.sequelize.query("UPDATE rs_tree_count SET updated_at = :date WHERE id = :id", {
        replacements: { date: new Date("2020-01-01"), id: old.id }
      });

      expect(await indexIds({ projectCohort: [cohort], lastModifiedDate: new Date("2021-01-01") })).toEqual([
        recent.uuid
      ]);
    });

    it("ignores empty filter arrays", async () => {
      const cohort = `cohort-${faker.string.alphanumeric(10)}`;
      const { project } = await createForProject({ cohort });

      expect(await indexIds({ projectId: [], projectCohort: [cohort] })).toEqual([project.uuid]);
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

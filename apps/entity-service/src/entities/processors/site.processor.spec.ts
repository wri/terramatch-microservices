import { Site } from "@terramatch-microservices/database/entities";
import { Test } from "@nestjs/testing";
import { MediaService } from "@terramatch-microservices/common/media/media.service";
import { createMock } from "@golevelup/ts-jest";
import { EntitiesService } from "../entities.service";
import { SiteProcessor } from "./site.processor";
import { reverse, sortBy } from "lodash";
import { EntityQueryDto } from "../dto/entity-query.dto";
import {
  ProjectFactory,
  ProjectUserFactory,
  SiteFactory,
  UserFactory
} from "@terramatch-microservices/database/factories";
import { buildJsonApi } from "@terramatch-microservices/common/util";
import { SiteFullDto, SiteLightDto } from "../dto/site.dto";
import { BadRequestException } from "@nestjs/common/exceptions/bad-request.exception";

describe("SiteProcessor", () => {
  let processor: SiteProcessor;
  let userId: number;

  beforeAll(async () => {
    userId = (await UserFactory.create()).id;
  });

  beforeEach(async () => {
    await Site.truncate();

    const module = await Test.createTestingModule({
      providers: [{ provide: MediaService, useValue: createMock<MediaService>() }, EntitiesService]
    }).compile();

    processor = module.get(EntitiesService).createEntityProcessor("sites") as SiteProcessor;
  });

  describe("findMany", () => {
    async function expectSites(
      expected: Site[],
      query: Omit<EntityQueryDto, "field" | "direction" | "size" | "number">,
      {
        permissions = ["sites-read"],
        sortField = "id",
        sortUp = true,
        total = expected.length
      }: { permissions?: string[]; sortField?: string; sortUp?: boolean; total?: number } = {}
    ) {
      const { models, paginationTotal } = await processor.findMany(query as EntityQueryDto, userId, permissions);
      expect(models.length).toBe(expected.length);
      expect(paginationTotal).toBe(total);

      const sorted = sortBy(expected, sortField);
      if (!sortUp) reverse(sorted);
      expect(models.map(({ id }) => id)).toEqual(sorted.map(({ id }) => id));
    }
    it("returns sites", async () => {
      const project = await ProjectFactory.create();
      await ProjectUserFactory.create({ userId, projectId: project.id });
      const managedSites = await SiteFactory.createMany(3, { projectId: project.id });
      await SiteFactory.createMany(5);
      await expectSites(managedSites, {}, { permissions: ["manage-own"] });
    });

    it("returns managed sites", async () => {
      const project = await ProjectFactory.create();
      await ProjectUserFactory.create({ userId, projectId: project.id, isMonitoring: false, isManaging: true });
      await ProjectFactory.create();
      const sites = await SiteFactory.createMany(3, { projectId: project.id });
      await SiteFactory.createMany(5);
      await expectSites(sites, {}, { permissions: ["projects-manage"] });
    });

    it("returns framework sites", async () => {
      const sites = await SiteFactory.createMany(3, { frameworkKey: "hbf" });
      await SiteFactory.createMany(3, { frameworkKey: "ppc" });
      for (const p of await SiteFactory.createMany(3, { frameworkKey: "terrafund" })) {
        sites.push(p);
      }

      await expectSites(sites, {}, { permissions: ["framework-hbf", "framework-terrafund"] });
    });

    it("searches", async () => {
      const s1 = await SiteFactory.create({ name: "Foo Bar" });
      const s2 = await SiteFactory.create({ name: "Baz Foo" });
      await SiteFactory.createMany(3);

      await expectSites([s1, s2], { search: "foo" });
    });

    it("filters", async () => {
      const project = await ProjectFactory.create();
      await ProjectUserFactory.create({ userId, projectId: project.id });

      const first = await SiteFactory.create({
        name: "first site",
        status: "approved",
        updateRequestStatus: "awaiting-approval",
        projectId: project.id
      });
      const second = await SiteFactory.create({
        name: "second site",
        status: "started",
        updateRequestStatus: "awaiting-approval",
        projectId: project.id
      });
      const third = await SiteFactory.create({
        name: "third site",
        status: "approved",
        updateRequestStatus: "awaiting-approval",
        projectId: project.id
      });

      await expectSites([first, second, third], { updateRequestStatus: "awaiting-approval" });
      await expectSites([first, second, third], { updateRequestStatus: "awaiting-approval" });
    });

    it("sorts by name", async () => {
      const siteA = await SiteFactory.create({ name: "A Site" });
      const siteB = await SiteFactory.create({ name: "B Site" });
      const siteC = await SiteFactory.create({ name: "C Site" });
      await expectSites([siteA, siteB, siteC], { sort: { field: "name", direction: "ASC" } }, { sortField: "name" });
      await expectSites([siteC, siteB, siteA], { sort: { field: "name", direction: "DESC" } }, { sortField: "name" });
    });

    it("sorts by project name", async () => {
      const projectA = await ProjectFactory.create({ name: "A Project" });
      const projectB = await ProjectFactory.create({ name: "B Project" });
      const projectC = await ProjectFactory.create({ name: "C Project" });
      const siteA = await SiteFactory.create({ projectId: projectA.id });
      const siteB = await SiteFactory.create({ projectId: projectB.id });
      const siteC = await SiteFactory.create({ projectId: projectC.id });
      await expectSites([siteA, siteB, siteC], { sort: { field: "projectName" } }, { sortField: "projectName" });
      await expectSites(
        [siteC, siteB, siteA],
        { sort: { field: "projectName", direction: "DESC" } },
        { sortField: "projectName" }
      );
    });

    it("should not sort by status", async () => {
      await SiteFactory.create({ status: "approved" });
      await SiteFactory.create({ status: "started" });
      await SiteFactory.create({ status: "awaiting-approval" });
      await expect(processor.findMany({ sort: { field: "status" } } as EntityQueryDto)).rejects.toThrow(
        BadRequestException
      );
    });
  });

  describe("findOne", () => {
    it("returns the requested site", async () => {
      const site = await SiteFactory.create();
      const result = await processor.findOne(site.uuid);
      expect(result.id).toBe(site.id);
    });
  });

  describe("DTOs", () => {
    it("SiteLightDto is a light resource", async () => {
      const { uuid } = await SiteFactory.create();
      const site = await processor.findOne(uuid);
      const document = buildJsonApi(SiteLightDto, { forceDataArray: true });
      await processor.addLightDto(document, site);
      const attributes = document.serialize().data[0].attributes as SiteLightDto;
      expect(attributes).toMatchObject({
        uuid,
        lightResource: true
      });
    });
    it("includes calculated fields in SiteFullDto", async () => {
      const project = await ProjectFactory.create();

      const { uuid } = await SiteFactory.create({
        projectId: project.id
      });

      const site = await processor.findOne(uuid);
      const document = buildJsonApi(SiteFullDto, { forceDataArray: true });
      await processor.addFullDto(document, site);
      const attributes = document.serialize().data[0].attributes as SiteFullDto;
      expect(attributes).toMatchObject({
        uuid,
        lightResource: false,
        projectUuid: project.uuid
      });
    });
  });
});

/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { Site } from "@terramatch-microservices/database/entities";
import { Test } from "@nestjs/testing";
import { MediaService } from "@terramatch-microservices/common/media/media.service";
import { createMock, DeepMocked } from "@golevelup/ts-jest";
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
import { BadRequestException } from "@nestjs/common/exceptions/bad-request.exception";
import { PolicyService } from "@terramatch-microservices/common";
import { SiteLightDto } from "../dto/site.dto";
import { buildJsonApi } from "@terramatch-microservices/common/util";
import { SiteReportFactory } from "@terramatch-microservices/database/factories/site-report.factory";
import { NotAcceptableException } from "@nestjs/common";
import { LocalizationService } from "@terramatch-microservices/common/localization/localization.service";

describe("SiteProcessor", () => {
  let processor: SiteProcessor;
  let policyService: DeepMocked<PolicyService>;
  let userId: number;

  beforeAll(async () => {
    userId = (await UserFactory.create()).id;
  });

  beforeEach(async () => {
    await Site.truncate();

    const module = await Test.createTestingModule({
      providers: [
        { provide: MediaService, useValue: createMock<MediaService>() },
        { provide: PolicyService, useValue: (policyService = createMock<PolicyService>({ userId })) },
        { provide: LocalizationService, useValue: createMock<LocalizationService>() },
        EntitiesService
      ]
    }).compile();

    processor = module.get(EntitiesService).createEntityProcessor("sites") as SiteProcessor;
  });

  afterEach(async () => {
    jest.resetAllMocks();
  });

  describe("findMany", () => {
    async function expectSites(
      expected: Site[],
      query: Omit<EntityQueryDto, "field" | "direction" | "size" | "number">,
      {
        permissions = [],
        sortField = "id",
        sortUp = true,
        total = expected.length
      }: { permissions?: string[]; sortField?: string; sortUp?: boolean; total?: number } = {}
    ) {
      policyService.getPermissions.mockResolvedValue(permissions);
      const { models, paginationTotal } = await processor.findMany(query as EntityQueryDto);
      expect(models.length).toBe(expected.length);
      expect(paginationTotal).toBe(total);

      const sorted = sortBy(expected, sortField);
      if (!sortUp) reverse(sorted);
      expect(models.map(({ id }) => id)).toEqual(sorted.map(({ id }) => id));
    }

    it("should returns sites", async () => {
      const project = await ProjectFactory.create();
      await ProjectUserFactory.create({ userId, projectId: project.id });
      const managedSites = await SiteFactory.createMany(3, { projectId: project.id });
      await SiteFactory.createMany(5);
      await expectSites(managedSites, {}, { permissions: ["manage-own"] });
    });

    it("should returns managed sites", async () => {
      const project = await ProjectFactory.create();
      await ProjectUserFactory.create({ userId, projectId: project.id, isMonitoring: false, isManaging: true });
      await ProjectFactory.create();
      const sites = await SiteFactory.createMany(3, { projectId: project.id });
      await SiteFactory.createMany(5);
      await expectSites(sites, {}, { permissions: ["projects-manage"] });
    });

    it("should returns framework sites", async () => {
      const sites = await SiteFactory.createMany(3, { frameworkKey: "hbf" });
      await SiteFactory.createMany(3, { frameworkKey: "ppc" });
      for (const p of await SiteFactory.createMany(3, { frameworkKey: "terrafund" })) {
        sites.push(p);
      }

      await expectSites(sites, {}, { permissions: ["framework-hbf", "framework-terrafund"] });
    });

    it("filters", async () => {
      const p1 = await ProjectFactory.create();
      const p2 = await ProjectFactory.create();
      await ProjectUserFactory.create({ userId, projectId: p1.id });
      await ProjectUserFactory.create({ userId, projectId: p2.id });

      const first = await SiteFactory.create({
        name: "first site",
        status: "approved",
        updateRequestStatus: "awaiting-approval",
        projectId: p1.id
      });
      const second = await SiteFactory.create({
        name: "second site",
        status: "started",
        updateRequestStatus: "awaiting-approval",
        projectId: p1.id
      });
      const third = await SiteFactory.create({
        name: "third site",
        status: "approved",
        updateRequestStatus: "awaiting-approval",
        projectId: p1.id
      });
      const fourth = await SiteFactory.create({
        name: "fourth site",
        status: "approved",
        updateRequestStatus: "approved",
        projectId: p2.id
      });

      await expectSites([first, second, third], { updateRequestStatus: "awaiting-approval" });

      await expectSites([fourth], { projectUuid: p2.uuid });
    });

    it("should throw an error if the project uuid is not found", async () => {
      await expect(processor.findMany({ projectUuid: "123" })).rejects.toThrow(BadRequestException);
    });

    it("sorts by name", async () => {
      const siteA = await SiteFactory.create({ name: "A Site" });
      const siteB = await SiteFactory.create({ name: "B Site" });
      const siteC = await SiteFactory.create({ name: "C Site" });
      await expectSites([siteA, siteB, siteC], { sort: { field: "name" } }, { sortField: "name" });
      await expectSites([siteA, siteB, siteC], { sort: { field: "name", direction: "ASC" } }, { sortField: "name" });
      await expectSites(
        [siteC, siteB, siteA],
        { sort: { field: "name", direction: "DESC" } },
        { sortField: "name", sortUp: false }
      );
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

    it("should throw an error if the sort field is not recognized", async () => {
      policyService.getPermissions.mockResolvedValue([]);
      await expect(processor.findMany({ sort: { field: "foo" } })).rejects.toThrow(BadRequestException);
    });

    it("should support search", async () => {
      const project = await ProjectFactory.create({ name: "Fancy Project" });
      const site = await SiteFactory.create({ name: "Boring Site", projectId: project.id });

      await expectSites([site], { search: "Fancy" });
      await expectSites([], { searchFilter: "Fancy" });
      await expectSites([site], { search: "Boring" });
      await expectSites([site], { searchFilter: "Boring" });
    });

    describe("processSideloads", () => {
      it("should throw", async () => {
        policyService.getPermissions.mockResolvedValue(["framework-terrafund"]);
        await SiteFactory.create({ frameworkKey: "terrafund" });
        await expect(
          processor.addIndex(buildJsonApi(SiteLightDto), { sideloads: [{ entity: "siteReports", pageSize: 1 }] })
        ).rejects.toThrow(BadRequestException);
      });
    });
  });

  describe("findOne", () => {
    it("should return a requested site", async () => {
      const site = await SiteFactory.create();
      const result = await processor.findOne(site.uuid);
      expect(result?.id).toBe(site.id);
    });
  });

  describe("DTOs", () => {
    it("should serialize a Site as a light resource (SiteLightDto)", async () => {
      const { uuid } = await SiteFactory.create();
      const site = await processor.findOne(uuid);
      const { id, dto } = await processor.getLightDto(site!);
      expect(id).toEqual(uuid);
      expect(dto).toMatchObject({
        uuid,
        lightResource: true
      });
    });
    it("should includes calculated fields in SiteFullDto", async () => {
      const project = await ProjectFactory.create();

      const { uuid } = await SiteFactory.create({
        projectId: project.id
      });

      const site = await processor.findOne(uuid);
      const { id, dto } = await processor.getFullDto(site!);
      expect(id).toEqual(uuid);
      expect(dto).toMatchObject({
        uuid,
        lightResource: false,
        projectUuid: project.uuid
      });
    });
  });

  describe("delete", () => {
    it("should allow an admin to delete a site", async () => {
      const site = await SiteFactory.create();
      policyService.getPermissions.mockResolvedValue(["manage-own"]);
      await processor.delete(site);
      expect(site.deletedAt).not.toBeNull();
    });

    it("should not allow a non-admin to delete a site if it has reports", async () => {
      const site = await SiteFactory.create();
      await SiteReportFactory.create({ siteId: site.id });
      policyService.getPermissions.mockResolvedValue(["manage-own"]);
      await expect(processor.delete(site)).rejects.toThrow(NotAcceptableException);
    });

    it("should allow a non-admin to delete a site if it has no reports", async () => {
      const site = await SiteFactory.create();
      policyService.getPermissions.mockResolvedValue(["manage-own"]);
      await processor.delete(site);
      expect(site.deletedAt).not.toBeNull();
    });
  });
});

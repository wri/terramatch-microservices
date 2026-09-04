import { Test, TestingModule } from "@nestjs/testing";
import { BadRequestException } from "@nestjs/common";
import { CriteriaSite, SitePolygon } from "@terramatch-microservices/database/entities";
import {
  IndicatorOutputTreeCoverFactory,
  ProjectFactory,
  SiteFactory,
  SitePolygonFactory
} from "@terramatch-microservices/database/factories";
import { VALIDATION_CRITERIA_IDS } from "@terramatch-microservices/database/constants";
import { SitePolygonMapIndexService } from "./site-polygon-map-index.service";
import { SitePolygonMapIndexQueryDto } from "./dto/site-polygon-map-index-query.dto";

describe("SitePolygonMapIndexService", () => {
  let service: SitePolygonMapIndexService;

  const getMapIndex = (query: Partial<SitePolygonMapIndexQueryDto>) =>
    service.getMapIndex(query as SitePolygonMapIndexQueryDto);

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SitePolygonMapIndexService]
    }).compile();

    service = module.get(SitePolygonMapIndexService);
  });

  afterEach(async () => {
    await CriteriaSite.truncate();
    await SitePolygon.truncate();
  });

  describe("scope validation", () => {
    it("rejects a request with no scope", async () => {
      await expect(getMapIndex({})).rejects.toThrow(BadRequestException);
    });

    it("rejects a request with both siteId[] and projectId[]", async () => {
      await expect(getMapIndex({ siteId: ["site-uuid"], projectId: ["project-uuid"] })).rejects.toThrow(
        BadRequestException
      );
    });

    it("rejects deletedOnly without exactly one siteId[]", async () => {
      await expect(getMapIndex({ projectId: ["project-uuid"], deletedOnly: true })).rejects.toThrow(
        BadRequestException
      );
      await expect(getMapIndex({ siteId: ["a", "b"], deletedOnly: true })).rejects.toThrow(BadRequestException);
    });

    it("rejects an inverted plantStart range", async () => {
      await expect(
        getMapIndex({
          siteId: ["site-uuid"],
          plantStartFrom: new Date("2024-06-01"),
          plantStartTo: new Date("2024-01-01")
        })
      ).rejects.toThrow(BadRequestException);
    });

    it("rejects using missingIndicator[] and presentIndicator[] together", async () => {
      await expect(
        getMapIndex({ siteId: ["site-uuid"], missingIndicator: ["treeCover"], presentIndicator: ["treeCover"] })
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("site scope", () => {
    it("returns only uuid, polygonUuid and status for each polygon", async () => {
      const site = await SiteFactory.create();
      const polygon = await SitePolygonFactory.create({ siteUuid: site.uuid, status: "approved" });

      const result = await getMapIndex({ siteId: [site.uuid] });

      expect(result.total).toBe(1);
      expect(result.polygons).toEqual([{ uuid: polygon.uuid, polygonUuid: polygon.polygonUuid, status: "approved" }]);
      expect(Object.keys(result.polygons[0]).sort()).toEqual(["polygonUuid", "status", "uuid"]);
    });

    it("excludes polygons from other sites", async () => {
      const site = await SiteFactory.create();
      const otherSite = await SiteFactory.create();
      const polygon = await SitePolygonFactory.create({ siteUuid: site.uuid });
      await SitePolygonFactory.create({ siteUuid: otherSite.uuid });

      const result = await getMapIndex({ siteId: [site.uuid] });

      expect(result.polygons.map(({ uuid }) => uuid)).toEqual([polygon.uuid]);
    });

    it("excludes inactive versions", async () => {
      const site = await SiteFactory.create();
      const active = await SitePolygonFactory.create({ siteUuid: site.uuid, isActive: true });
      await SitePolygonFactory.create({ siteUuid: site.uuid, isActive: false });

      const result = await getMapIndex({ siteId: [site.uuid] });

      expect(result.polygons.map(({ uuid }) => uuid)).toEqual([active.uuid]);
    });

    it("excludes soft-deleted polygons by default", async () => {
      const site = await SiteFactory.create();
      const kept = await SitePolygonFactory.create({ siteUuid: site.uuid });
      const removed = await SitePolygonFactory.create({ siteUuid: site.uuid });
      await removed.destroy();

      const result = await getMapIndex({ siteId: [site.uuid] });

      expect(result.polygons.map(({ uuid }) => uuid)).toEqual([kept.uuid]);
    });
  });

  describe("project scope", () => {
    it("resolves a project to the polygons of all its sites", async () => {
      const project = await ProjectFactory.create();
      const siteA = await SiteFactory.create({ projectId: project.id });
      const siteB = await SiteFactory.create({ projectId: project.id });
      const polygonA = await SitePolygonFactory.create({ siteUuid: siteA.uuid });
      const polygonB = await SitePolygonFactory.create({ siteUuid: siteB.uuid });

      const otherProject = await ProjectFactory.create();
      const otherSite = await SiteFactory.create({ projectId: otherProject.id });
      await SitePolygonFactory.create({ siteUuid: otherSite.uuid });

      const result = await getMapIndex({ projectId: [project.uuid] });

      expect(result.total).toBe(2);
      expect(result.polygons.map(({ uuid }) => uuid).sort()).toEqual([polygonA.uuid, polygonB.uuid].sort());
    });

    it("returns an empty list for an unknown project", async () => {
      const result = await getMapIndex({ projectId: ["00000000-0000-0000-0000-000000000000"] });

      expect(result).toEqual({ polygons: [], total: 0 });
    });
  });

  describe("filters", () => {
    it("filters by polygon status", async () => {
      const site = await SiteFactory.create();
      const approved = await SitePolygonFactory.create({ siteUuid: site.uuid, status: "approved" });
      await SitePolygonFactory.create({ siteUuid: site.uuid, status: "draft" });

      const result = await getMapIndex({ siteId: [site.uuid], polygonStatus: ["approved"] });

      expect(result.polygons.map(({ uuid }) => uuid)).toEqual([approved.uuid]);
    });

    it("filters by validation status", async () => {
      const site = await SiteFactory.create();
      const passed = await SitePolygonFactory.create({ siteUuid: site.uuid, validationStatus: "passed" });
      await SitePolygonFactory.create({ siteUuid: site.uuid, validationStatus: "failed" });

      const result = await getMapIndex({ siteId: [site.uuid], validationStatus: ["passed"] });

      expect(result.polygons.map(({ uuid }) => uuid)).toEqual([passed.uuid]);
    });

    it("filters by plant start range", async () => {
      const site = await SiteFactory.create();
      const inRange = await SitePolygonFactory.create({ siteUuid: site.uuid, plantStart: new Date("2024-03-01") });
      await SitePolygonFactory.create({ siteUuid: site.uuid, plantStart: new Date("2023-01-01") });

      const result = await getMapIndex({
        siteId: [site.uuid],
        plantStartFrom: new Date("2024-01-01"),
        plantStartTo: new Date("2024-12-31")
      });

      expect(result.polygons.map(({ uuid }) => uuid)).toEqual([inRange.uuid]);
    });

    it("filters by target system", async () => {
      const site = await SiteFactory.create();
      const mangrove = await SitePolygonFactory.create({ siteUuid: site.uuid, targetSys: "mangrove" });
      await SitePolygonFactory.create({ siteUuid: site.uuid, targetSys: "urban-forest" });

      const result = await getMapIndex({ siteId: [site.uuid], targetSys: ["mangrove"] });

      expect(result.polygons.map(({ uuid }) => uuid)).toEqual([mangrove.uuid]);
    });

    it("filters by restoration practice", async () => {
      const site = await SiteFactory.create();
      const seeding = await SitePolygonFactory.create({ siteUuid: site.uuid, practice: ["direct-seeding"] });
      await SitePolygonFactory.create({ siteUuid: site.uuid, practice: ["planting"] });

      const result = await getMapIndex({ siteId: [site.uuid], practice: ["direct-seeding"] });

      expect(result.polygons.map(({ uuid }) => uuid)).toEqual([seeding.uuid]);
    });

    it("filters to polygons with a failed overlap validation", async () => {
      const site = await SiteFactory.create();
      const overlapping = await SitePolygonFactory.create({ siteUuid: site.uuid });
      await SitePolygonFactory.create({ siteUuid: site.uuid });
      await CriteriaSite.create({
        polygonId: overlapping.polygonUuid,
        criteriaId: VALIDATION_CRITERIA_IDS.OVERLAPPING,
        valid: false
      } as CriteriaSite);

      const result = await getMapIndex({ siteId: [site.uuid], hasOverlap: true });

      expect(result.polygons.map(({ uuid }) => uuid)).toEqual([overlapping.uuid]);
    });

    it("filters to polygons missing an indicator", async () => {
      const site = await SiteFactory.create();
      const withIndicator = await SitePolygonFactory.create({ siteUuid: site.uuid });
      const missing = await SitePolygonFactory.create({ siteUuid: site.uuid });
      await IndicatorOutputTreeCoverFactory.create({
        sitePolygonId: withIndicator.id,
        indicatorSlug: "treeCover"
      });

      const result = await getMapIndex({ siteId: [site.uuid], missingIndicator: ["treeCover"] });

      expect(result.polygons.map(({ uuid }) => uuid)).toEqual([missing.uuid]);
    });

    it("filters to polygons that have an indicator", async () => {
      const site = await SiteFactory.create();
      const withIndicator = await SitePolygonFactory.create({ siteUuid: site.uuid });
      await SitePolygonFactory.create({ siteUuid: site.uuid });
      await IndicatorOutputTreeCoverFactory.create({
        sitePolygonId: withIndicator.id,
        indicatorSlug: "treeCover"
      });

      const result = await getMapIndex({ siteId: [site.uuid], presentIndicator: ["treeCover"] });

      expect(result.polygons.map(({ uuid }) => uuid)).toEqual([withIndicator.uuid]);
    });
  });

  describe("search", () => {
    it("matches on polygon name", async () => {
      const site = await SiteFactory.create();
      const match = await SitePolygonFactory.create({ siteUuid: site.uuid, polyName: "Riverbank North" });
      await SitePolygonFactory.create({ siteUuid: site.uuid, polyName: "Hillside South" });

      const result = await getMapIndex({ siteId: [site.uuid], search: "iverbank", searchFields: ["polyName"] });

      expect(result.polygons.map(({ uuid }) => uuid)).toEqual([match.uuid]);
    });

    it("matches on site name without joining the site table", async () => {
      const site = await SiteFactory.create({ name: "Coastal Mangrove Site" });
      const otherSite = await SiteFactory.create({ name: "Upland Site" });
      const match = await SitePolygonFactory.create({ siteUuid: site.uuid });
      await SitePolygonFactory.create({ siteUuid: otherSite.uuid });

      const result = await getMapIndex({
        siteId: [site.uuid, otherSite.uuid],
        search: "Mangrove",
        searchFields: ["siteName"]
      });

      expect(result.polygons.map(({ uuid }) => uuid)).toEqual([match.uuid]);
    });

    it("matches on polygon geometry uuid", async () => {
      const site = await SiteFactory.create();
      const match = await SitePolygonFactory.create({ siteUuid: site.uuid });
      await SitePolygonFactory.create({ siteUuid: site.uuid });

      const result = await getMapIndex({
        siteId: [site.uuid],
        search: match.polygonUuid,
        searchFields: ["polygonUuid"]
      });

      expect(result.polygons.map(({ uuid }) => uuid)).toEqual([match.uuid]);
    });
  });

  describe("deletedOnly", () => {
    it("returns only soft-deleted polygons for the site", async () => {
      const site = await SiteFactory.create();
      await SitePolygonFactory.create({ siteUuid: site.uuid });
      const removed = await SitePolygonFactory.create({ siteUuid: site.uuid });
      await removed.destroy();

      const result = await getMapIndex({ siteId: [site.uuid], deletedOnly: true });

      expect(result.polygons.map(({ uuid }) => uuid)).toEqual([removed.uuid]);
    });
  });

  describe("getResourceId", () => {
    it("identifies a site scope regardless of uuid order", () => {
      const id = service.getResourceId({ siteId: ["b", "a"] } as SitePolygonMapIndexQueryDto);

      expect(id).toBe("sites:a,b");
    });

    it("identifies a project scope", () => {
      const id = service.getResourceId({ projectId: ["p1"] } as SitePolygonMapIndexQueryDto);

      expect(id).toBe("projects:p1");
    });

    it("distinguishes the soft-deleted branch", () => {
      const id = service.getResourceId({ siteId: ["s1"], deletedOnly: true } as SitePolygonMapIndexQueryDto);

      expect(id).toBe("deleted:sites:s1");
    });
  });
});

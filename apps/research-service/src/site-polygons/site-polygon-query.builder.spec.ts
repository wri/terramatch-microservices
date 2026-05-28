import { Test, TestingModule } from "@nestjs/testing";
import { SitePolygonQueryBuilder } from "./site-polygon-query.builder";
import { SitePolygonFactory, ProjectFactory, SiteFactory } from "@terramatch-microservices/database/factories";
import { CriteriaSite, SitePolygon } from "@terramatch-microservices/database/entities";
import { VALIDATION_CRITERIA_IDS } from "@terramatch-microservices/database/constants";
import { BadRequestException } from "@nestjs/common";
import { LandscapeSlug } from "@terramatch-microservices/database/types/landscapeGeometry";

describe("SitePolygonQueryBuilder", () => {
  let builder: SitePolygonQueryBuilder;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SitePolygonQueryBuilder]
    }).compile();

    builder = module.get<SitePolygonQueryBuilder>(SitePolygonQueryBuilder);
  });

  afterEach(async () => {
    await CriteriaSite.truncate();
    await SitePolygon.truncate();
  });
  describe("filterProjectShortNames", () => {
    it("should filter by project short names", async () => {
      const project1 = await ProjectFactory.create({ shortName: "PROJ-A" });
      const project2 = await ProjectFactory.create({ shortName: "PROJ-B" });
      const site1 = await SiteFactory.create({ projectId: project1.id });
      const site2 = await SiteFactory.create({ projectId: project2.id });

      await SitePolygonFactory.create({ siteUuid: site1.uuid });
      await SitePolygonFactory.create({ siteUuid: site2.uuid });

      await builder.filterProjectShortNames(["PROJ-A"]);
      const result = await builder.execute();

      expect(result.length).toBe(1);
      expect(result[0].siteUuid).toBe(site1.uuid);
    });
  });

  describe("filterValidationStatus", () => {
    it("should return records with null when including not_checked and other statuses", async () => {
      const project = await ProjectFactory.create();
      const site = await SiteFactory.create({ projectId: project.id });
      const polyPassed = await SitePolygonFactory.create({ siteUuid: site.uuid, validationStatus: "passed" });
      const polyNull = await SitePolygonFactory.create({ siteUuid: site.uuid, validationStatus: null });

      await builder.filterValidationStatus(["passed", "not_checked"]);
      const result = await builder.execute();

      expect(result.map(p => p.id).sort()).toEqual([polyNull.id, polyPassed.id].sort());
    });

    it("should return only null when filtering by not_checked", async () => {
      const project = await ProjectFactory.create();
      const site = await SiteFactory.create({ projectId: project.id });
      await SitePolygonFactory.create({ siteUuid: site.uuid, validationStatus: "passed" });
      const polyNull = await SitePolygonFactory.create({ siteUuid: site.uuid, validationStatus: null });

      await builder.filterValidationStatus(["not_checked"]);
      const result = await builder.execute();

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(polyNull.id);
    });

    it("should return only matching explicit statuses when not including not_checked", async () => {
      const project = await ProjectFactory.create();
      const site = await SiteFactory.create({ projectId: project.id });
      const polyPassed = await SitePolygonFactory.create({ siteUuid: site.uuid, validationStatus: "passed" });
      await SitePolygonFactory.create({ siteUuid: site.uuid, validationStatus: null });

      await builder.filterValidationStatus(["passed"]);
      const result = await builder.execute();

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(polyPassed.id);
    });
  });

  describe("filterPolygonUuids", () => {
    it("should filter by polygon uuids", async () => {
      const project = await ProjectFactory.create();
      const site = await SiteFactory.create({ projectId: project.id });
      const poly1 = await SitePolygonFactory.create({ siteUuid: site.uuid });
      await SitePolygonFactory.create({ siteUuid: site.uuid });

      await builder.filterPolygonUuids([poly1.polygonUuid]);
      const result = await builder.execute();

      expect(result).toHaveLength(1);
      expect(result[0].polygonUuid).toBe(poly1.polygonUuid);
    });
  });

  describe("filterPlantStartRange", () => {
    it("should include bounds inclusively and exclude null plantStart", async () => {
      const project = await ProjectFactory.create();
      const site = await SiteFactory.create({ projectId: project.id });
      const from = new Date(Date.UTC(2024, 5, 1));
      const to = new Date(Date.UTC(2024, 5, 30));
      const onStart = await SitePolygonFactory.create({
        siteUuid: site.uuid,
        plantStart: new Date(Date.UTC(2024, 5, 1)),
        practice: ["tree-planting"],
        distr: ["full"]
      });
      const onEnd = await SitePolygonFactory.create({
        siteUuid: site.uuid,
        plantStart: new Date(Date.UTC(2024, 5, 30)),
        practice: ["tree-planting"],
        distr: ["full"]
      });
      const inside = await SitePolygonFactory.create({
        siteUuid: site.uuid,
        plantStart: new Date(Date.UTC(2024, 5, 15)),
        practice: ["tree-planting"],
        distr: ["full"]
      });
      await SitePolygonFactory.create({
        siteUuid: site.uuid,
        plantStart: new Date(Date.UTC(2024, 4, 31)),
        practice: ["tree-planting"],
        distr: ["full"]
      });
      await SitePolygonFactory.create({
        siteUuid: site.uuid,
        plantStart: new Date(Date.UTC(2024, 6, 1)),
        practice: ["tree-planting"],
        distr: ["full"]
      });
      await SitePolygonFactory.create({
        siteUuid: site.uuid,
        plantStart: null,
        practice: ["tree-planting"],
        distr: ["full"]
      });

      builder.filterPlantStartRange(from, to);
      const result = await builder.execute();

      expect(result.map(p => p.id).sort()).toEqual([onStart.id, onEnd.id, inside.id].sort());
    });
  });

  describe("filterPractice", () => {
    it("should match any overlapping practice (OR) and exclude null practice", async () => {
      const project = await ProjectFactory.create();
      const site = await SiteFactory.create({ projectId: project.id });
      const a = await SitePolygonFactory.create({
        siteUuid: site.uuid,
        practice: ["tree-planting"],
        distr: ["full"]
      });
      const b = await SitePolygonFactory.create({
        siteUuid: site.uuid,
        practice: ["direct-seeding"],
        distr: ["full"]
      });
      await SitePolygonFactory.create({
        siteUuid: site.uuid,
        practice: ["assisted-natural-regeneration"],
        distr: ["full"]
      });
      await SitePolygonFactory.create({ siteUuid: site.uuid, practice: null, distr: ["full"] });

      builder.filterPractice(["tree-planting", "direct-seeding"]);
      const result = await builder.execute();

      expect(result.map(p => p.id).sort()).toEqual([a.id, b.id].sort());
    });
  });

  describe("filterDistr", () => {
    it("should match any overlapping distr (OR) and exclude null distr", async () => {
      const project = await ProjectFactory.create();
      const site = await SiteFactory.create({ projectId: project.id });
      const a = await SitePolygonFactory.create({
        siteUuid: site.uuid,
        practice: ["tree-planting"],
        distr: ["single-line"]
      });
      const b = await SitePolygonFactory.create({
        siteUuid: site.uuid,
        practice: ["tree-planting"],
        distr: ["partial"]
      });
      await SitePolygonFactory.create({
        siteUuid: site.uuid,
        practice: ["tree-planting"],
        distr: ["full"]
      });
      await SitePolygonFactory.create({ siteUuid: site.uuid, practice: ["tree-planting"], distr: null });

      builder.filterDistr(["single-line", "partial"]);
      const result = await builder.execute();

      expect(result.map(p => p.id).sort()).toEqual([a.id, b.id].sort());
    });
  });

  describe("filterTargetSys", () => {
    it("should match any selected targetSys", async () => {
      const project = await ProjectFactory.create();
      const site = await SiteFactory.create({ projectId: project.id });
      const match = await SitePolygonFactory.create({
        siteUuid: site.uuid,
        practice: ["tree-planting"],
        distr: ["full"],
        targetSys: "mangrove"
      });
      await SitePolygonFactory.create({
        siteUuid: site.uuid,
        practice: ["tree-planting"],
        distr: ["full"],
        targetSys: "urban-forest"
      });
      await SitePolygonFactory.create({
        siteUuid: site.uuid,
        practice: ["tree-planting"],
        distr: ["full"],
        targetSys: null
      });

      builder.filterTargetSys(["mangrove"]);
      const result = await builder.execute();

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(match.id);
    });
  });

  describe("filterSource", () => {
    it("should match any selected source", async () => {
      const project = await ProjectFactory.create();
      const site = await SiteFactory.create({ projectId: project.id });
      const match = await SitePolygonFactory.create({
        siteUuid: site.uuid,
        practice: ["tree-planting"],
        distr: ["full"],
        source: "greenhouse"
      });
      await SitePolygonFactory.create({
        siteUuid: site.uuid,
        practice: ["tree-planting"],
        distr: ["full"],
        source: "terramatch"
      });
      await SitePolygonFactory.create({
        siteUuid: site.uuid,
        practice: ["tree-planting"],
        distr: ["full"],
        source: null
      });

      builder.filterSource(["greenhouse"]);
      const result = await builder.execute();

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(match.id);
    });
  });

  describe("filterHasOverlap", () => {
    it("should return only polygons with failed overlap validation when enabled", async () => {
      const project = await ProjectFactory.create();
      const site = await SiteFactory.create({ projectId: project.id });
      const failedOverlap = await SitePolygonFactory.create({ siteUuid: site.uuid });
      const passedOverlap = await SitePolygonFactory.create({ siteUuid: site.uuid });
      await SitePolygonFactory.create({ siteUuid: site.uuid });
      const failedOverlapPolygonUuid = failedOverlap.polygonUuid;
      const passedOverlapPolygonUuid = passedOverlap.polygonUuid;
      if (failedOverlapPolygonUuid == null || passedOverlapPolygonUuid == null) {
        throw new Error("Expected polygonUuid to be defined for overlap test fixtures");
      }

      await CriteriaSite.create({
        polygonId: failedOverlapPolygonUuid,
        criteriaId: VALIDATION_CRITERIA_IDS.OVERLAPPING,
        valid: false
      } as CriteriaSite);
      await CriteriaSite.create({
        polygonId: passedOverlapPolygonUuid,
        criteriaId: VALIDATION_CRITERIA_IDS.OVERLAPPING,
        valid: true
      } as CriteriaSite);

      builder.filterHasOverlap(true);
      const result = await builder.execute();

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(failedOverlap.id);
    });

    it("should not filter polygons when disabled", async () => {
      const project = await ProjectFactory.create();
      const site = await SiteFactory.create({ projectId: project.id });
      const failedOverlap = await SitePolygonFactory.create({ siteUuid: site.uuid });
      const noOverlapValidation = await SitePolygonFactory.create({ siteUuid: site.uuid });
      const failedOverlapPolygonUuid = failedOverlap.polygonUuid;
      if (failedOverlapPolygonUuid == null) {
        throw new Error("Expected polygonUuid to be defined for overlap test fixture");
      }

      await CriteriaSite.create({
        polygonId: failedOverlapPolygonUuid,
        criteriaId: VALIDATION_CRITERIA_IDS.OVERLAPPING,
        valid: false
      } as CriteriaSite);

      builder.filterHasOverlap(false);
      const result = await builder.execute();

      expect(result.map(p => p.id).sort()).toEqual([failedOverlap.id, noOverlapValidation.id].sort());
    });
  });

  describe("combined attribute filters", () => {
    it("should AND hasStatuses with filterPractice", async () => {
      const project = await ProjectFactory.create();
      const site = await SiteFactory.create({ projectId: project.id });
      const match = await SitePolygonFactory.create({
        siteUuid: site.uuid,
        status: "pending-approval",
        practice: ["tree-planting"],
        distr: ["full"]
      });
      await SitePolygonFactory.create({
        siteUuid: site.uuid,
        status: "draft",
        practice: ["tree-planting"],
        distr: ["full"]
      });
      await SitePolygonFactory.create({
        siteUuid: site.uuid,
        status: "pending-approval",
        practice: ["direct-seeding"],
        distr: ["full"]
      });

      builder.hasStatuses(["pending-approval"]).filterPractice(["tree-planting"]);
      const result = await builder.execute();

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(match.id);
    });
  });

  describe("no-op filters", () => {
    it("hasStatuses should not filter when statuses are not provided", async () => {
      const project = await ProjectFactory.create();
      const site = await SiteFactory.create({ projectId: project.id });
      const polygonA = await SitePolygonFactory.create({ siteUuid: site.uuid, status: "draft" });
      const polygonB = await SitePolygonFactory.create({ siteUuid: site.uuid, status: "approved" });

      builder.hasStatuses(undefined);
      const result = await builder.execute();

      expect(result.map(p => p.id).sort()).toEqual([polygonA.id, polygonB.id].sort());
    });

    it("modifiedSince should not filter when date is undefined", async () => {
      const project = await ProjectFactory.create();
      const site = await SiteFactory.create({ projectId: project.id });
      const polygonA = await SitePolygonFactory.create({ siteUuid: site.uuid });
      const polygonB = await SitePolygonFactory.create({ siteUuid: site.uuid });

      builder.modifiedSince(undefined);
      const result = await builder.execute();

      expect(result.map(p => p.id).sort()).toEqual([polygonA.id, polygonB.id].sort());
    });

    it("filterPlantStartRange should not filter when both bounds are undefined", async () => {
      const project = await ProjectFactory.create();
      const site = await SiteFactory.create({ projectId: project.id });
      const withDate = await SitePolygonFactory.create({
        siteUuid: site.uuid,
        plantStart: new Date(Date.UTC(2024, 0, 1))
      });
      const withoutDate = await SitePolygonFactory.create({ siteUuid: site.uuid, plantStart: null });

      builder.filterPlantStartRange(undefined, undefined);
      const result = await builder.execute();

      expect(result.map(p => p.id).sort()).toEqual([withDate.id, withoutDate.id].sort());
    });

    it("filterPractice, filterDistr, filterTargetSys and filterSource should no-op on empty arrays", async () => {
      const project = await ProjectFactory.create();
      const site = await SiteFactory.create({ projectId: project.id });
      const polygon = await SitePolygonFactory.create({
        siteUuid: site.uuid,
        practice: ["tree-planting"],
        distr: ["full"],
        targetSys: "mangrove",
        source: "terramatch"
      });

      builder.filterPractice([]);
      builder.filterDistr([]);
      builder.filterTargetSys([]);
      builder.filterSource([]);
      const result = await builder.execute();

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(polygon.id);
    });

    it("filterHasOverlap should not filter when flag is undefined", async () => {
      const project = await ProjectFactory.create();
      const site = await SiteFactory.create({ projectId: project.id });
      const polygon = await SitePolygonFactory.create({ siteUuid: site.uuid });

      builder.filterHasOverlap(undefined);
      const result = await builder.execute();

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(polygon.id);
    });

    it("addSearch should no-op when requested fields do not include searchable columns", async () => {
      const project = await ProjectFactory.create();
      const site = await SiteFactory.create({ projectId: project.id });
      const polygon = await SitePolygonFactory.create({
        siteUuid: site.uuid,
        polyName: "Alpha Polygon"
      });

      await builder.addSearch("Alpha", []);
      const result = await builder.execute();

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(polygon.id);
    });
  });

  describe("project attribute validation", () => {
    it("should throw BadRequestException for an unrecognized landscape slug", async () => {
      await expect(builder.filterProjectAttributes(undefined, "does-not-exist-slug" as LandscapeSlug)).rejects.toThrow(
        BadRequestException
      );
    });
  });
});

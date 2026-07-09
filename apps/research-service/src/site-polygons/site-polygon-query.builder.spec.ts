import { Test, TestingModule } from "@nestjs/testing";
import { SitePolygonQueryBuilder } from "./site-polygon-query.builder";
import {
  SitePolygonFactory,
  ProjectFactory,
  SiteFactory,
  IndicatorOutputTreeCoverFactory,
  LandscapeGeometryFactory
} from "@terramatch-microservices/database/factories";
import { CriteriaSite, SitePolygon, Site } from "@terramatch-microservices/database/entities";
import { VALIDATION_CRITERIA_IDS } from "@terramatch-microservices/database/constants";
import { BadRequestException } from "@nestjs/common";
import { LandscapeSlug } from "@terramatch-microservices/database/types/landscapeGeometry";
import { Op, WhereOptions } from "sequelize";

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

    it("should return no records when filtering with an empty statuses array", async () => {
      const project = await ProjectFactory.create();
      const site = await SiteFactory.create({ projectId: project.id });
      await SitePolygonFactory.create({ siteUuid: site.uuid, validationStatus: "passed" });

      await builder.filterValidationStatus([]);
      const result = await builder.execute();

      expect(result).toHaveLength(0);
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

  describe("filterSiteUuids", () => {
    it("should filter by site uuids", async () => {
      const project = await ProjectFactory.create();
      const site1 = await SiteFactory.create({ projectId: project.id });
      const site2 = await SiteFactory.create({ projectId: project.id });
      await SitePolygonFactory.create({ siteUuid: site1.uuid });
      await SitePolygonFactory.create({ siteUuid: site2.uuid });

      await builder.filterSiteUuids([site1.uuid]);
      const result = await builder.execute();

      expect(result).toHaveLength(1);
      expect(result[0].siteUuid).toBe(site1.uuid);
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

    it("should apply only lower bound when to is undefined", async () => {
      const project = await ProjectFactory.create();
      const site = await SiteFactory.create({ projectId: project.id });
      const from = new Date(Date.UTC(2024, 5, 1));
      const included = await SitePolygonFactory.create({
        siteUuid: site.uuid,
        plantStart: new Date(Date.UTC(2024, 5, 2))
      });
      await SitePolygonFactory.create({
        siteUuid: site.uuid,
        plantStart: new Date(Date.UTC(2024, 4, 31))
      });

      builder.filterPlantStartRange(from, undefined);
      const result = await builder.execute();

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(included.id);
    });

    it("should apply only upper bound when from is undefined", async () => {
      const project = await ProjectFactory.create();
      const site = await SiteFactory.create({ projectId: project.id });
      const to = new Date(Date.UTC(2024, 5, 30));
      const included = await SitePolygonFactory.create({
        siteUuid: site.uuid,
        plantStart: new Date(Date.UTC(2024, 5, 29))
      });
      await SitePolygonFactory.create({
        siteUuid: site.uuid,
        plantStart: new Date(Date.UTC(2024, 6, 1))
      });

      builder.filterPlantStartRange(undefined, to);
      const result = await builder.execute();

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(included.id);
    });
  });

  describe("addSearch", () => {
    it("should search only site names when fields include only siteName", async () => {
      const project = await ProjectFactory.create();
      const siteAlpha = await SiteFactory.create({ projectId: project.id, name: "Alpha Site" });
      const siteBeta = await SiteFactory.create({ projectId: project.id, name: "Beta Site" });
      await SitePolygonFactory.create({ siteUuid: siteAlpha.uuid, polyName: "Polygon One" });
      await SitePolygonFactory.create({ siteUuid: siteBeta.uuid, polyName: "Alpha Polygon Name" });

      await builder.addSearch("Alpha", ["siteName"]);
      const result = await builder.execute();

      expect(result).toHaveLength(1);
      expect(result[0].siteUuid).toBe(siteAlpha.uuid);
    });

    it("should search polygon UUID when fields include polygonUuid", async () => {
      const project = await ProjectFactory.create();
      const site = await SiteFactory.create({ projectId: project.id });
      const target = await SitePolygonFactory.create({ siteUuid: site.uuid });
      await SitePolygonFactory.create({ siteUuid: site.uuid });
      const token = target.polygonUuid.slice(0, 8);

      await builder.addSearch(token, ["polygonUuid"]);
      const result = await builder.execute();

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(target.id);
    });

    it("should search only polygon names when fields include only polyName", async () => {
      const project = await ProjectFactory.create();
      const site = await SiteFactory.create({ projectId: project.id, name: "Alpha Site" });
      const target = await SitePolygonFactory.create({ siteUuid: site.uuid, polyName: "Target Poly" });
      await SitePolygonFactory.create({ siteUuid: site.uuid, polyName: "Other Polygon" });

      await builder.addSearch("Target", ["polyName"]);
      const result = await builder.execute();

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(target.id);
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

  describe("filterSubmissionCycle", () => {
    it("should match any overlapping submissionCycle (OR) and exclude null submissionCycle", async () => {
      const project = await ProjectFactory.create();
      const site = await SiteFactory.create({ projectId: project.id });
      const a = await SitePolygonFactory.create({
        siteUuid: site.uuid,
        practice: ["tree-planting"],
        distr: ["full"],
        submissionCycle: ["1"]
      });
      const b = await SitePolygonFactory.create({
        siteUuid: site.uuid,
        practice: ["tree-planting"],
        distr: ["full"],
        submissionCycle: ["2", "3"]
      });
      await SitePolygonFactory.create({
        siteUuid: site.uuid,
        practice: ["tree-planting"],
        distr: ["full"],
        submissionCycle: ["5"]
      });
      await SitePolygonFactory.create({
        siteUuid: site.uuid,
        practice: ["tree-planting"],
        distr: ["full"],
        submissionCycle: null
      });

      builder.filterSubmissionCycle(["1", "2"]);
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

    it("filterPractice, filterDistr, filterSubmissionCycle, filterTargetSys and filterSource should no-op on empty arrays", async () => {
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
      builder.filterSubmissionCycle([]);
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

    it("should not filter by cohort when cohort is empty", async () => {
      const project = await ProjectFactory.create();
      const site = await SiteFactory.create({ projectId: project.id });
      const polygon = await SitePolygonFactory.create({ siteUuid: site.uuid });

      await builder.filterProjectAttributes([]);
      const result = await builder.execute();

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(polygon.id);
    });

    it("should filter by landscape slug without cohort", async () => {
      const landscape = await LandscapeGeometryFactory.create({
        slug: "afr100-west-bengal" as LandscapeSlug,
        landscape: "West Bengal"
      });
      const matchingProject = await ProjectFactory.create({ landscape: landscape.landscape });
      const otherProject = await ProjectFactory.create({ landscape: "Other Landscape" });
      const matchingSite = await SiteFactory.create({ projectId: matchingProject.id });
      const otherSite = await SiteFactory.create({ projectId: otherProject.id });
      const matchingPolygon = await SitePolygonFactory.create({ siteUuid: matchingSite.uuid });
      await SitePolygonFactory.create({ siteUuid: otherSite.uuid });

      await builder.filterProjectAttributes(undefined, landscape.slug as LandscapeSlug);
      const result = await builder.execute();

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(matchingPolygon.id);
    });

    it("should filter by project UUIDs", async () => {
      const projectA = await ProjectFactory.create();
      const projectB = await ProjectFactory.create();
      const siteA = await SiteFactory.create({ projectId: projectA.id });
      const siteB = await SiteFactory.create({ projectId: projectB.id });
      const polygonA = await SitePolygonFactory.create({ siteUuid: siteA.uuid });
      await SitePolygonFactory.create({ siteUuid: siteB.uuid });

      await builder.filterProjectUuids([projectA.uuid]);
      const result = await builder.execute();

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(polygonA.id);
    });

    it("should exclude polygons from test projects", async () => {
      const testProject = await ProjectFactory.create({ isTest: true });
      const regularProject = await ProjectFactory.create({ isTest: false });
      const testSite = await SiteFactory.create({ projectId: testProject.id });
      const regularSite = await SiteFactory.create({ projectId: regularProject.id });
      await SitePolygonFactory.create({ siteUuid: testSite.uuid });
      const regularPolygon = await SitePolygonFactory.create({ siteUuid: regularSite.uuid });

      await builder.excludeTestProjects();
      const result = await builder.execute();

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(regularPolygon.id);
    });

    it("should filter by cohort and landscape when both are provided", async () => {
      const landscape = await LandscapeGeometryFactory.create({
        slug: "afr100-palawan" as LandscapeSlug,
        landscape: "Palawan"
      });
      const matchingProject = await ProjectFactory.create({
        cohort: "2024-q4",
        landscape: landscape.landscape
      });
      const wrongLandscapeProject = await ProjectFactory.create({
        cohort: "2024-q4",
        landscape: "Different Landscape"
      });
      const wrongCohortProject = await ProjectFactory.create({
        cohort: "2023-q3",
        landscape: landscape.landscape
      });
      const matchingSite = await SiteFactory.create({ projectId: matchingProject.id });
      const wrongLandscapeSite = await SiteFactory.create({ projectId: wrongLandscapeProject.id });
      const wrongCohortSite = await SiteFactory.create({ projectId: wrongCohortProject.id });
      const matchingPolygon = await SitePolygonFactory.create({ siteUuid: matchingSite.uuid });
      await SitePolygonFactory.create({ siteUuid: wrongLandscapeSite.uuid });
      await SitePolygonFactory.create({ siteUuid: wrongCohortSite.uuid });

      await builder.filterProjectAttributes(["2024-q4"], landscape.slug as LandscapeSlug);
      const result = await builder.execute();

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(matchingPolygon.id);
    });
  });

  describe("modifiedSince", () => {
    it("should add an updatedAt lower-bound filter", () => {
      const date = new Date(Date.UTC(2024, 1, 1));

      builder.modifiedSince(date);

      const where = (builder as unknown as { findOptions: { where: { [Op.and]: WhereOptions[] } } }).findOptions.where;
      expect(where[Op.and]).toEqual(expect.arrayContaining([{ isActive: true }, { updatedAt: { [Op.gte]: date } }]));
    });
  });

  describe("indicator filters", () => {
    it("isMissingIndicators should return polygons without the selected indicator", async () => {
      const project = await ProjectFactory.create();
      const site = await SiteFactory.create({ projectId: project.id });
      const withIndicator = await SitePolygonFactory.create({ siteUuid: site.uuid });
      const withoutIndicator = await SitePolygonFactory.create({ siteUuid: site.uuid });

      await IndicatorOutputTreeCoverFactory.create({
        sitePolygonId: withIndicator.id,
        indicatorSlug: "treeCover",
        yearOfAnalysis: 2024
      });

      builder.isMissingIndicators(["treeCover"]);
      const result = await builder.execute();

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(withoutIndicator.id);
    });

    it("hasPresentIndicators should return polygons with the selected indicator", async () => {
      const project = await ProjectFactory.create();
      const site = await SiteFactory.create({ projectId: project.id });
      const withIndicator = await SitePolygonFactory.create({ siteUuid: site.uuid });
      await SitePolygonFactory.create({ siteUuid: site.uuid });

      await IndicatorOutputTreeCoverFactory.create({
        sitePolygonId: withIndicator.id,
        indicatorSlug: "treeCover",
        yearOfAnalysis: 2025
      });

      builder.hasPresentIndicators(["treeCover"]);
      const result = await builder.execute();

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(withIndicator.id);
    });

    it("should throw for unknown indicator slugs", () => {
      expect(() => builder.isMissingIndicators(["not-a-real-indicator" as never])).toThrow(BadRequestException);
      expect(() => builder.hasPresentIndicators(["not-a-real-indicator" as never])).toThrow(BadRequestException);
    });
  });

  describe("builder constructor defaults", () => {
    it("marks site include as required", () => {
      const includes = ((
        builder as unknown as { findOptions: { include: Array<{ model?: unknown; required?: boolean }> } }
      ).findOptions.include ?? []) as Array<{ model?: unknown; required?: boolean }>;
      const siteInclude = includes.find(include => include.model === Site);

      expect(siteInclude?.required).toBe(true);
    });
  });
});

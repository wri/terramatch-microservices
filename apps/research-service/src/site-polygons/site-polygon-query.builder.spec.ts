import { Test } from "@nestjs/testing";
import { SitePolygonQueryBuilder } from "./site-polygon-query.builder";
import {
  IndicatorOutputHectaresFactory,
  IndicatorOutputMsuCarbonFactory,
  IndicatorOutputTreeCoverFactory,
  LandscapeGeometryFactory,
  ProjectFactory,
  SiteFactory,
  SitePolygonFactory
} from "@terramatch-microservices/database/factories";
import { Project, SitePolygon } from "@terramatch-microservices/database/entities";
import { BadRequestException, InternalServerErrorException } from "@nestjs/common";
import { IndicatorSlug } from "@terramatch-microservices/database/constants";
import { LandscapeSlug } from "@terramatch-microservices/database/types/landscapeGeometry";

describe("SitePolygonQueryBuilder", () => {
  beforeEach(async () => {
    await Test.createTestingModule({
      providers: [SitePolygonQueryBuilder]
    }).compile();
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await SitePolygon.truncate({ cascade: true });
    await Project.truncate({ cascade: true });
  });

  describe("Constructor", () => {
    it("should initialize with default page size", () => {
      const builder = new SitePolygonQueryBuilder();
      expect(builder).toBeDefined();
    });

    it("should initialize with custom page size", () => {
      const builder = new SitePolygonQueryBuilder(50);
      expect(builder).toBeDefined();
    });

    it("should include required associations", () => {
      const builder = new SitePolygonQueryBuilder();
      // @ts-expect-error accessing private property for testing
      const findOptions = builder.findOptions;

      expect(findOptions.include).toBeDefined();
      expect(findOptions.include).toHaveLength(2);
      expect(findOptions.include).not.toBeNull();
      expect(findOptions.include?.[0].model).toBeDefined(); // PolygonGeometry
      expect(findOptions.include?.[1].model).toBeDefined(); // Site with Project
    });

    it("should set default where conditions", () => {
      const builder = new SitePolygonQueryBuilder();
      // @ts-expect-error accessing private property for testing
      const findOptions = builder.findOptions;

      expect(findOptions.where).toEqual({ isActive: true });
    });
  });

  describe("excludeTestProjects", () => {
    it("should exclude test projects from results", async () => {
      const testProject = await ProjectFactory.create({ isTest: true });
      const normalProject = await ProjectFactory.create({ isTest: false });

      const testSite = await SiteFactory.create({ projectId: testProject.id });
      const normalSite = await SiteFactory.create({ projectId: normalProject.id });

      await SitePolygonFactory.create({ siteUuid: testSite.uuid });
      const normalPolygon = await SitePolygonFactory.create({ siteUuid: normalSite.uuid });

      const builder = new SitePolygonQueryBuilder();
      await builder.excludeTestProjects();
      const result = await builder.execute();

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(normalPolygon.id);
    });

    it("should include all polygons when no test projects exist", async () => {
      const project1 = await ProjectFactory.create({ isTest: false });
      const project2 = await ProjectFactory.create({ isTest: false });

      const site1 = await SiteFactory.create({ projectId: project1.id });
      const site2 = await SiteFactory.create({ projectId: project2.id });

      const polygon1 = await SitePolygonFactory.create({ siteUuid: site1.uuid });
      const polygon2 = await SitePolygonFactory.create({ siteUuid: site2.uuid });

      const builder = new SitePolygonQueryBuilder();
      await builder.excludeTestProjects();
      const result = await builder.execute();

      expect(result).toHaveLength(2);
      expect(result.map(p => p.id).sort()).toEqual([polygon1.id, polygon2.id].sort());
    });
  });

  describe("filterSiteUuids", () => {
    it("should filter by site UUIDs", async () => {
      const site1 = await SiteFactory.create();
      const site2 = await SiteFactory.create();
      const site3 = await SiteFactory.create();

      const polygon1 = await SitePolygonFactory.create({ siteUuid: site1.uuid });
      const polygon2 = await SitePolygonFactory.create({ siteUuid: site2.uuid });
      await SitePolygonFactory.create({ siteUuid: site3.uuid });

      const builder = new SitePolygonQueryBuilder();
      await builder.filterSiteUuids([site1.uuid, site2.uuid]);
      const result = await builder.execute();

      expect(result).toHaveLength(2);
      expect(result.map(p => p.id).sort()).toEqual([polygon1.id, polygon2.id].sort());
    });

    it("should return empty result for non-existent UUIDs", async () => {
      await SitePolygonFactory.create();

      const builder = new SitePolygonQueryBuilder();
      await builder.filterSiteUuids(["non-existent-uuid"]);
      const result = await builder.execute();

      expect(result).toHaveLength(0);
    });
  });

  describe("filterProjectAttributes", () => {
    it("should filter by cohort", async () => {
      const terrafundProject = await ProjectFactory.create({ cohort: ["terrafund"] });
      const ppcProject = await ProjectFactory.create({ cohort: ["ppc"] });
      const mixedProject = await ProjectFactory.create({ cohort: ["terrafund", "ppc"] });

      const terrafundSite = await SiteFactory.create({ projectId: terrafundProject.id });
      const ppcSite = await SiteFactory.create({ projectId: ppcProject.id });
      const mixedSite = await SiteFactory.create({ projectId: mixedProject.id });

      const terrafundPolygon = await SitePolygonFactory.create({ siteUuid: terrafundSite.uuid });
      await SitePolygonFactory.create({ siteUuid: ppcSite.uuid });
      const mixedPolygon = await SitePolygonFactory.create({ siteUuid: mixedSite.uuid });

      const builder = new SitePolygonQueryBuilder();
      await builder.filterProjectAttributes(["terrafund"]);
      const result = await builder.execute();

      expect(result).toHaveLength(2);
      expect(result.map(p => p.id).sort()).toEqual([terrafundPolygon.id, mixedPolygon.id].sort());
    });

    it("should filter by landscape slug", async () => {
      const landscape1 = await LandscapeGeometryFactory.create();
      const landscape2 = await LandscapeGeometryFactory.create();

      const project1 = await ProjectFactory.create({ landscape: landscape1.landscape });
      const project2 = await ProjectFactory.create({ landscape: landscape2.landscape });

      const site1 = await SiteFactory.create({ projectId: project1.id });
      const site2 = await SiteFactory.create({ projectId: project2.id });

      const polygon1 = await SitePolygonFactory.create({ siteUuid: site1.uuid });
      await SitePolygonFactory.create({ siteUuid: site2.uuid });

      const builder = new SitePolygonQueryBuilder();
      await builder.filterProjectAttributes(undefined, landscape1.slug as LandscapeSlug);
      const result = await builder.execute();

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(polygon1.id);
    });

    it("should filter by both cohort and landscape", async () => {
      const landscape = await LandscapeGeometryFactory.create();

      const project1 = await ProjectFactory.create({
        landscape: landscape.landscape,
        cohort: ["terrafund"]
      });
      const project2 = await ProjectFactory.create({
        landscape: landscape.landscape,
        cohort: ["ppc"]
      });
      const project3 = await ProjectFactory.create({
        landscape: landscape.landscape,
        cohort: ["terrafund", "ppc"]
      });

      const site1 = await SiteFactory.create({ projectId: project1.id });
      const site2 = await SiteFactory.create({ projectId: project2.id });
      const site3 = await SiteFactory.create({ projectId: project3.id });

      const polygon1 = await SitePolygonFactory.create({ siteUuid: site1.uuid });
      await SitePolygonFactory.create({ siteUuid: site2.uuid });
      const polygon3 = await SitePolygonFactory.create({ siteUuid: site3.uuid });

      const builder = new SitePolygonQueryBuilder();
      await builder.filterProjectAttributes(["terrafund"], landscape.slug as LandscapeSlug);
      const result = await builder.execute();

      expect(result).toHaveLength(2);
      expect(result.map(p => p.id).sort()).toEqual([polygon1.id, polygon3.id].sort());
    });

    it("should throw BadRequestException for invalid landscape slug", async () => {
      const builder = new SitePolygonQueryBuilder();

      await expect(builder.filterProjectAttributes(undefined, "invalid-slug" as LandscapeSlug)).rejects.toThrow(
        BadRequestException
      );
    });
  });

  describe("filterProjectShortNames", () => {
    it("should filter by project short names", async () => {
      const project1 = await ProjectFactory.create({ shortName: "PROJ1" });
      const project2 = await ProjectFactory.create({ shortName: "PROJ2" });
      const project3 = await ProjectFactory.create({ shortName: "PROJ3" });

      const site1 = await SiteFactory.create({ projectId: project1.id });
      const site2 = await SiteFactory.create({ projectId: project2.id });
      const site3 = await SiteFactory.create({ projectId: project3.id });

      const polygon1 = await SitePolygonFactory.create({ siteUuid: site1.uuid });
      const polygon2 = await SitePolygonFactory.create({ siteUuid: site2.uuid });
      await SitePolygonFactory.create({ siteUuid: site3.uuid });

      const builder = new SitePolygonQueryBuilder();
      await builder.filterProjectShortNames(["PROJ1", "PROJ2"]);
      const result = await builder.execute();

      expect(result).toHaveLength(2);
      expect(result.map(p => p.id).sort()).toEqual([polygon1.id, polygon2.id].sort());
    });

    it("should return empty result for non-existent short names", async () => {
      await SitePolygonFactory.create();

      const builder = new SitePolygonQueryBuilder();
      await builder.filterProjectShortNames(["NON_EXISTENT"]);
      const result = await builder.execute();

      expect(result).toHaveLength(0);
    });
  });

  describe("filterProjectUuids", () => {
    it("should filter by project UUIDs", async () => {
      const project1 = await ProjectFactory.create();
      const project2 = await ProjectFactory.create();
      const project3 = await ProjectFactory.create();

      const site1 = await SiteFactory.create({ projectId: project1.id });
      const site2 = await SiteFactory.create({ projectId: project2.id });
      const site3 = await SiteFactory.create({ projectId: project3.id });

      const polygon1 = await SitePolygonFactory.create({ siteUuid: site1.uuid });
      const polygon2 = await SitePolygonFactory.create({ siteUuid: site2.uuid });
      await SitePolygonFactory.create({ siteUuid: site3.uuid });

      const builder = new SitePolygonQueryBuilder();
      await builder.filterProjectUuids([project1.uuid, project2.uuid]);
      const result = await builder.execute();

      expect(result).toHaveLength(2);
      expect(result.map(p => p.id).sort()).toEqual([polygon1.id, polygon2.id].sort());
    });
  });

  describe("filterValidationStatus", () => {
    it("should filter by specific validation statuses", async () => {
      const approvedPolygon = await SitePolygonFactory.create({ validationStatus: "approved" });
      const pendingPolygon = await SitePolygonFactory.create({ validationStatus: "pending" });
      await SitePolygonFactory.create({ validationStatus: "rejected" });

      const builder = new SitePolygonQueryBuilder();
      await builder.filterValidationStatus(["approved", "pending"]);
      const result = await builder.execute();

      expect(result).toHaveLength(2);
      expect(result.map(p => p.id).sort()).toEqual([approvedPolygon.id, pendingPolygon.id].sort());
    });

    it("should filter for not checked (null) validation status", async () => {
      await SitePolygonFactory.create({ validationStatus: "approved" });
      const notCheckedPolygon = await SitePolygonFactory.create({ validationStatus: null });

      const builder = new SitePolygonQueryBuilder();
      await builder.filterValidationStatus(["not_checked"]);
      const result = await builder.execute();

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(notCheckedPolygon.id);
    });

    it("should filter for both not checked and specific statuses", async () => {
      const approvedPolygon = await SitePolygonFactory.create({ validationStatus: "approved" });
      const notCheckedPolygon = await SitePolygonFactory.create({ validationStatus: null });
      await SitePolygonFactory.create({ validationStatus: "rejected" });

      const builder = new SitePolygonQueryBuilder();
      await builder.filterValidationStatus(["not_checked", "approved"]);
      const result = await builder.execute();

      expect(result).toHaveLength(2);
      expect(result.map(p => p.id).sort()).toEqual([approvedPolygon.id, notCheckedPolygon.id].sort());
    });

    it("should handle empty validation status array", async () => {
      await SitePolygonFactory.create({ validationStatus: "approved" });

      const builder = new SitePolygonQueryBuilder();
      await builder.filterValidationStatus([]);
      const result = await builder.execute();

      expect(result).toHaveLength(0);
    });
  });

  describe("addSearch", () => {
    it("should search by site name prefix", async () => {
      const project = await ProjectFactory.create();
      const alphaSite = await SiteFactory.create({ projectId: project.id, name: "Alpha Site" });
      const betaSite = await SiteFactory.create({ projectId: project.id, name: "Beta Site" });

      const alphaPolygon = await SitePolygonFactory.create({ siteUuid: alphaSite.uuid });
      await SitePolygonFactory.create({ siteUuid: betaSite.uuid });

      const builder = new SitePolygonQueryBuilder();
      await builder.addSearch("Alpha");
      const result = await builder.execute();

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(alphaPolygon.id);
    });

    it("should search by site name containing term", async () => {
      const project = await ProjectFactory.create();
      const alphaSite = await SiteFactory.create({ projectId: project.id, name: "Alpha Site" });
      const betaSite = await SiteFactory.create({ projectId: project.id, name: "Beta Alpha Site" });
      const gammaSite = await SiteFactory.create({ projectId: project.id, name: "Gamma Site" });

      const alphaPolygon = await SitePolygonFactory.create({ siteUuid: alphaSite.uuid });
      const betaPolygon = await SitePolygonFactory.create({ siteUuid: betaSite.uuid });
      await SitePolygonFactory.create({ siteUuid: gammaSite.uuid });

      const builder = new SitePolygonQueryBuilder();
      await builder.addSearch("Alpha");
      const result = await builder.execute();

      expect(result).toHaveLength(2);
      expect(result.map(p => p.id).sort()).toEqual([alphaPolygon.id, betaPolygon.id].sort());
    });

    it("should search by polygon name prefix", async () => {
      const site = await SiteFactory.create();
      const alphaPolygon = await SitePolygonFactory.create({
        siteUuid: site.uuid,
        polyName: "Alpha Polygon"
      });
      await SitePolygonFactory.create({
        siteUuid: site.uuid,
        polyName: "Beta Polygon"
      });

      const builder = new SitePolygonQueryBuilder();
      await builder.addSearch("Alpha");
      const result = await builder.execute();

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(alphaPolygon.id);
    });

    it("should search by polygon name containing term", async () => {
      const site = await SiteFactory.create();
      const alphaPolygon = await SitePolygonFactory.create({
        siteUuid: site.uuid,
        polyName: "Alpha Polygon"
      });
      const betaPolygon = await SitePolygonFactory.create({
        siteUuid: site.uuid,
        polyName: "Beta Alpha Polygon"
      });
      await SitePolygonFactory.create({
        siteUuid: site.uuid,
        polyName: "Gamma Polygon"
      });

      const builder = new SitePolygonQueryBuilder();
      await builder.addSearch("Alpha");
      const result = await builder.execute();

      expect(result).toHaveLength(2);
      expect(result.map(p => p.id).sort()).toEqual([alphaPolygon.id, betaPolygon.id].sort());
    });
  });

  describe("hasStatuses", () => {
    it("should filter by polygon statuses", async () => {
      const draftPolygon = await SitePolygonFactory.create({ status: "draft" });
      const submittedPolygon = await SitePolygonFactory.create({ status: "submitted" });
      await SitePolygonFactory.create({ status: "approved" });

      const builder = new SitePolygonQueryBuilder();
      builder.hasStatuses(["draft", "submitted"]);
      const result = await builder.execute();

      expect(result).toHaveLength(2);
      expect(result.map(p => p.id).sort()).toEqual([draftPolygon.id, submittedPolygon.id].sort());
    });

    it("should return all polygons when no statuses specified", async () => {
      const polygon1 = await SitePolygonFactory.create({ status: "draft" });
      const polygon2 = await SitePolygonFactory.create({ status: "submitted" });

      const builder = new SitePolygonQueryBuilder();
      builder.hasStatuses();
      const result = await builder.execute();

      expect(result).toHaveLength(2);
      expect(result.map(p => p.id).sort()).toEqual([polygon1.id, polygon2.id].sort());
    });
  });

  describe("modifiedSince", () => {
    it("should return all polygons when no date specified", async () => {
      const polygon1 = await SitePolygonFactory.create();
      const polygon2 = await SitePolygonFactory.create();

      const builder = new SitePolygonQueryBuilder();
      builder.modifiedSince();
      const result = await builder.execute();

      expect(result).toHaveLength(2);
      expect(result.map(p => p.id).sort()).toEqual([polygon1.id, polygon2.id].sort());
    });
  });

  describe("isMissingIndicators", () => {
    it("should filter polygons missing specific indicators", async () => {
      const polygon1 = await SitePolygonFactory.create();
      const polygon2 = await SitePolygonFactory.create();

      await IndicatorOutputTreeCoverFactory.create({ sitePolygonId: polygon1.id });
      await IndicatorOutputHectaresFactory.create({
        sitePolygonId: polygon2.id,
        indicatorSlug: "restorationByStrategy"
      });

      const builder = new SitePolygonQueryBuilder();
      builder.isMissingIndicators(["treeCover"]);
      const result = await builder.execute();

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(polygon2.id);
    });

    it("should filter polygons missing multiple indicators", async () => {
      const polygon1 = await SitePolygonFactory.create();
      const polygon2 = await SitePolygonFactory.create();
      const polygon3 = await SitePolygonFactory.create();

      await IndicatorOutputTreeCoverFactory.create({ sitePolygonId: polygon1.id });
      await IndicatorOutputHectaresFactory.create({
        sitePolygonId: polygon2.id,
        indicatorSlug: "restorationByStrategy"
      });
      await IndicatorOutputMsuCarbonFactory.create({ sitePolygonId: polygon3.id });

      const builder = new SitePolygonQueryBuilder();
      builder.isMissingIndicators(["treeCover", "restorationByStrategy"]);
      const result = await builder.execute();

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(polygon3.id);
    });

    it("should throw BadRequestException for invalid indicator slug", () => {
      const builder = new SitePolygonQueryBuilder();

      expect(() => builder.isMissingIndicators(["invalid-slug" as IndicatorSlug])).toThrow(BadRequestException);
    });
  });

  describe("hasPresentIndicators", () => {
    it("should filter polygons with specific indicators present", async () => {
      const polygon1 = await SitePolygonFactory.create();
      const polygon2 = await SitePolygonFactory.create();

      await IndicatorOutputTreeCoverFactory.create({ sitePolygonId: polygon1.id });
      await IndicatorOutputHectaresFactory.create({
        sitePolygonId: polygon2.id,
        indicatorSlug: "restorationByStrategy"
      });

      const builder = new SitePolygonQueryBuilder();
      builder.hasPresentIndicators(["treeCover"]);
      const result = await builder.execute();

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(polygon1.id);
    });

    it("should filter polygons with multiple indicators present", async () => {
      const polygon1 = await SitePolygonFactory.create();
      const polygon2 = await SitePolygonFactory.create();
      const polygon3 = await SitePolygonFactory.create();

      await IndicatorOutputTreeCoverFactory.create({ sitePolygonId: polygon1.id });
      await IndicatorOutputHectaresFactory.create({
        sitePolygonId: polygon1.id,
        indicatorSlug: "restorationByStrategy"
      });
      await IndicatorOutputHectaresFactory.create({
        sitePolygonId: polygon2.id,
        indicatorSlug: "restorationByStrategy"
      });
      await IndicatorOutputMsuCarbonFactory.create({ sitePolygonId: polygon3.id });

      const builder = new SitePolygonQueryBuilder();
      builder.hasPresentIndicators(["treeCover", "restorationByStrategy"]);
      const result = await builder.execute();

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(polygon1.id);
    });

    it("should throw BadRequestException for invalid indicator slug", () => {
      const builder = new SitePolygonQueryBuilder();

      expect(() => builder.hasPresentIndicators(["invalid-slug" as IndicatorSlug])).toThrow(BadRequestException);
    });
  });

  describe("sql property", () => {
    it("should return sequelize instance", () => {
      const builder = new SitePolygonQueryBuilder();
      expect(builder.sql).toBeDefined();
    });

    it("should throw InternalServerErrorException when sequelize is null", () => {
      const originalSequelize = Project.sequelize;
      // @ts-expect-error overriding readonly property for test
      Project.sequelize = null;

      const builder = new SitePolygonQueryBuilder();
      expect(() => builder.sql).toThrow(InternalServerErrorException);

      // Restore the original value
      // @ts-expect-error restoring readonly property after test
      Project.sequelize = originalSequelize;
    });
  });

  describe("Complex queries", () => {
    it("should handle multiple filters combined", async () => {
      const testProject = await ProjectFactory.create({ isTest: true });
      const normalProject = await ProjectFactory.create({ isTest: false });

      const testSite = await SiteFactory.create({ projectId: testProject.id });
      const normalSite = await SiteFactory.create({ projectId: normalProject.id });

      await SitePolygonFactory.create({
        siteUuid: testSite.uuid,
        status: "draft"
      });
      const normalPolygon = await SitePolygonFactory.create({
        siteUuid: normalSite.uuid,
        status: "draft"
      });
      await SitePolygonFactory.create({
        siteUuid: normalSite.uuid,
        status: "approved"
      });

      const builder = new SitePolygonQueryBuilder();
      await builder.excludeTestProjects();
      builder.hasStatuses(["draft"]);
      const result = await builder.execute();

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(normalPolygon.id);
    });

    it("should handle search with other filters", async () => {
      const project = await ProjectFactory.create();
      const alphaSite = await SiteFactory.create({
        projectId: project.id,
        name: "Alpha Site"
      });
      const betaSite = await SiteFactory.create({
        projectId: project.id,
        name: "Beta Site"
      });

      const alphaPolygon = await SitePolygonFactory.create({
        siteUuid: alphaSite.uuid,
        status: "draft"
      });
      await SitePolygonFactory.create({
        siteUuid: betaSite.uuid,
        status: "draft"
      });

      const builder = new SitePolygonQueryBuilder();
      await builder.addSearch("Alpha");
      builder.hasStatuses(["draft"]);
      const result = await builder.execute();

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(alphaPolygon.id);
    });
  });
});

import { Test, TestingModule } from "@nestjs/testing";
import { SitePolygonQueryBuilder } from "./site-polygon-query.builder";
import { SitePolygonFactory, ProjectFactory, SiteFactory } from "@terramatch-microservices/database/factories";
import { SitePolygon } from "@terramatch-microservices/database/entities";

describe("SitePolygonQueryBuilder", () => {
  let builder: SitePolygonQueryBuilder;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SitePolygonQueryBuilder]
    }).compile();

    builder = module.get<SitePolygonQueryBuilder>(SitePolygonQueryBuilder);
  });

  afterEach(async () => {
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
      const poly1 = await SitePolygonFactory.create({ siteUuid: site.uuid, polygonUuid: "poly-1" });
      await SitePolygonFactory.create({ siteUuid: site.uuid, polygonUuid: "poly-2" });

      await builder.filterPolygonUuids(["poly-1"]);
      const result = await builder.execute();

      expect(result).toHaveLength(1);
      expect(result[0].polygonUuid).toBe(poly1.polygonUuid);
    });
  });
});

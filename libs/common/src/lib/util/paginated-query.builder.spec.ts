import { IncludeOptions, Op } from "sequelize";
import { sortBy } from "lodash";
import { BadRequestException } from "@nestjs/common";
import { Project, Site, SiteReport } from "@terramatch-microservices/database/entities";
import {
  ProjectFactory,
  SiteFactory,
  SiteReportFactory,
  TreeSpeciesFactory
} from "@terramatch-microservices/database/factories";
import { combineWheresWithAnd, MAX_PAGE_SIZE, PaginatedQueryBuilder } from "./paginated-query.builder";

describe("combineWheresWithAnd", () => {
  it("returns the other clause when one side is empty", () => {
    expect(combineWheresWithAnd({}, { id: 1 })).toEqual({ id: 1 });
    expect(combineWheresWithAnd({ id: 1 }, {})).toEqual({ id: 1 });
  });

  it("flattens existing AND clauses", () => {
    expect(combineWheresWithAnd({ [Op.and]: [{ id: 1 }, { uuid: "a" }] }, { name: "b" })).toEqual({
      [Op.and]: [{ id: 1 }, { uuid: "a" }, { name: "b" }]
    });
  });

  it("does not flatten a clause with keys other than AND", () => {
    expect(combineWheresWithAnd({ id: 1, uuid: "a" }, { [Op.or]: [{ name: "b" }] })).toEqual({
      [Op.and]: [{ id: 1, uuid: "a" }, { [Op.or]: [{ name: "b" }] }]
    });
  });
});

describe("PaginatedQueryBuilder", () => {
  let project: Project;
  let sites: Site[];

  beforeEach(async () => {
    // Every query is scoped to this project so that data from other tests doesn't interfere.
    project = await ProjectFactory.create();
    // createMany creates the records concurrently, so they need to be sorted to match the default id order.
    sites = sortBy(await SiteFactory.createMany(5, { projectId: project.id }), "id");
  });

  const projectSites = (builder: PaginatedQueryBuilder<Site>) => builder.where({ projectId: project.id });
  const ids = (models: Site[]) => models.map(({ id }) => id);

  describe("forCursorPage", () => {
    it("defaults to the max page size", () => {
      expect(PaginatedQueryBuilder.forCursorPage(Site).pageSize).toBe(MAX_PAGE_SIZE);
    });

    it("validates the page size", () => {
      expect(() => PaginatedQueryBuilder.forCursorPage(Site, { size: MAX_PAGE_SIZE + 1 })).toThrow(BadRequestException);
      expect(() => PaginatedQueryBuilder.forCursorPage(Site, { size: 0 })).toThrow(BadRequestException);
    });

    it("returns the page after the given cursor", async () => {
      const builder = projectSites(PaginatedQueryBuilder.forCursorPage(Site, { size: 2 }));
      await builder.pageAfter(sites[1].uuid);
      expect(ids(await builder.execute())).toEqual(ids(sites.slice(2, 4)));
      // The cursor does not affect the total.
      expect(await builder.paginationTotal()).toBe(5);
    });

    it("accepts a custom where clause for finding the cursor record", async () => {
      const builder = projectSites(PaginatedQueryBuilder.forCursorPage(Site, { size: 2 }));
      await builder.pageAfter(String(sites[2].id), { id: sites[2].id });
      expect(ids(await builder.execute())).toEqual(ids(sites.slice(3, 5)));
    });

    it("throws if the cursor record doesn't exist", async () => {
      await expect(PaginatedQueryBuilder.forCursorPage(Site).pageAfter("not-a-real-uuid")).rejects.toThrow(
        BadRequestException
      );
    });
  });

  describe("forNumberPage", () => {
    it("returns the requested page", async () => {
      const builder = projectSites(PaginatedQueryBuilder.forNumberPage(Site, { size: 2, number: 2 }));
      expect(ids(await builder.execute())).toEqual(ids(sites.slice(2, 4)));
      expect(await builder.paginationTotal()).toBe(5);
    });

    it("validates the page number", () => {
      expect(() => PaginatedQueryBuilder.forNumberPage(Site, { number: 0 })).toThrow(BadRequestException);
    });

    it("throws when setting a page number without a page size", () => {
      expect(() => new PaginatedQueryBuilder(Site).pageNumber(2)).toThrow(BadRequestException);
    });
  });

  it("supports includes, ordering and attributes", async () => {
    const builder = projectSites(
      new PaginatedQueryBuilder(Site, 10, [{ association: "project", attributes: ["uuid"] }])
    )
      .order([["id", "DESC"]])
      .attributes(["id", "projectId"]);

    const results = await builder.execute();
    expect(ids(results)).toEqual(ids(sites).reverse());
    expect(results[0].project?.uuid).toBe(project.uuid);
    expect(results[0].uuid).toBeUndefined();
  });

  it("applies where clauses to an include when given a filterable", async () => {
    const include: IncludeOptions = { association: "project", attributes: ["uuid"] };
    const builder = new PaginatedQueryBuilder(Site, 10, [include]).where({ id: project.id }, include);
    const results = await builder.execute();
    expect(ids(results)).toEqual(ids(sites));
  });

  it("adds computed attributes to the query", async () => {
    const site = sites[0];
    const report = await SiteReportFactory.create({ siteId: site.id });
    await TreeSpeciesFactory.siteReportTreePlanted(report).create({ amount: 10 });
    await TreeSpeciesFactory.siteReportTreePlanted(report).create({ amount: 15 });

    const results = await new PaginatedQueryBuilder(SiteReport, 10)
      .where({ siteId: site.id })
      .attributes(["id"])
      .addComputedAttribute(SiteReport.TOTAL_TREES_PLANTED_COUNT_ATTRIBUTE)
      .group("SiteReport.id")
      .execute();

    expect(results.length).toBe(1);
    expect(Number(results[0].get("totalTreesPlantedCount"))).toBe(25);
  });
});

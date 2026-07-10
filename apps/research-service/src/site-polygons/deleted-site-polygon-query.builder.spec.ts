import { Test, TestingModule } from "@nestjs/testing";
import { DeletedSitePolygonQueryBuilder } from "./deleted-site-polygon-query.builder";
import { ProjectFactory, SiteFactory, SitePolygonFactory } from "@terramatch-microservices/database/factories";
import { SitePolygon } from "@terramatch-microservices/database/entities";

describe("DeletedSitePolygonQueryBuilder", () => {
  let builder: DeletedSitePolygonQueryBuilder;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DeletedSitePolygonQueryBuilder]
    }).compile();

    builder = module.get<DeletedSitePolygonQueryBuilder>(DeletedSitePolygonQueryBuilder);
  });

  afterEach(async () => {
    await SitePolygon.truncate();
  });

  it("returns the active version of a fully-deleted polygon group", async () => {
    const project = await ProjectFactory.create();
    const site = await SiteFactory.create({ projectId: project.id });
    const primaryUuid = crypto.randomUUID();

    const oldVersion = await SitePolygonFactory.create({ siteUuid: site.uuid, primaryUuid, isActive: false });
    const activeVersion = await SitePolygonFactory.create({ siteUuid: site.uuid, primaryUuid, isActive: true });

    // Simulate a full delete: every version in the primaryUuid group is soft-deleted together.
    await SitePolygon.destroy({ where: { primaryUuid } });

    const result = await builder.filterSiteUuids([site.uuid]).execute();

    expect(result).toHaveLength(1);
    expect(result[0].uuid).toBe(activeVersion.uuid);
    expect(result[0].deletedAt).not.toBeNull();
    expect(oldVersion.uuid).not.toBe(result[0].uuid);
  });

  it("excludes polygons where only a non-active version was cleaned up", async () => {
    const project = await ProjectFactory.create();
    const site = await SiteFactory.create({ projectId: project.id });
    const primaryUuid = crypto.randomUUID();

    const oldVersion = await SitePolygonFactory.create({ siteUuid: site.uuid, primaryUuid, isActive: false });
    await SitePolygonFactory.create({ siteUuid: site.uuid, primaryUuid, isActive: true });

    // Version housekeeping deletes only the inactive version; the polygon is still live on the site.
    await SitePolygon.destroy({ where: { uuid: oldVersion.uuid } });

    const result = await builder.filterSiteUuids([site.uuid]).execute();

    expect(result).toHaveLength(0);
  });

  it("does not return live (non-deleted) polygons", async () => {
    const project = await ProjectFactory.create();
    const site = await SiteFactory.create({ projectId: project.id });
    await SitePolygonFactory.create({ siteUuid: site.uuid, isActive: true });

    const result = await builder.filterSiteUuids([site.uuid]).execute();

    expect(result).toHaveLength(0);
  });

  describe("filterSiteUuids", () => {
    it("scopes results to the requested site", async () => {
      const project = await ProjectFactory.create();
      const site1 = await SiteFactory.create({ projectId: project.id });
      const site2 = await SiteFactory.create({ projectId: project.id });

      const polygon1 = await SitePolygonFactory.create({ siteUuid: site1.uuid, isActive: true });
      await SitePolygon.destroy({ where: { primaryUuid: polygon1.primaryUuid } });

      const polygon2 = await SitePolygonFactory.create({ siteUuid: site2.uuid, isActive: true });
      await SitePolygon.destroy({ where: { primaryUuid: polygon2.primaryUuid } });

      const result = await builder.filterSiteUuids([site1.uuid]).execute();

      expect(result).toHaveLength(1);
      expect(result[0].siteUuid).toBe(site1.uuid);
    });
  });

  it("orders results by deletion date, most recent first", async () => {
    const project = await ProjectFactory.create();
    const site = await SiteFactory.create({ projectId: project.id });

    const olderDeletion = await SitePolygonFactory.create({ siteUuid: site.uuid, isActive: true });
    await SitePolygon.destroy({ where: { primaryUuid: olderDeletion.primaryUuid } });
    await SitePolygon.update(
      { deletedAt: new Date(Date.UTC(2024, 0, 1)) },
      { where: { uuid: olderDeletion.uuid }, paranoid: false }
    );

    const newerDeletion = await SitePolygonFactory.create({ siteUuid: site.uuid, isActive: true });
    await SitePolygon.destroy({ where: { primaryUuid: newerDeletion.primaryUuid } });
    await SitePolygon.update(
      { deletedAt: new Date(Date.UTC(2024, 5, 1)) },
      { where: { uuid: newerDeletion.uuid }, paranoid: false }
    );

    const result = await builder.filterSiteUuids([site.uuid]).execute();

    expect(result.map(({ uuid }) => uuid)).toEqual([newerDeletion.uuid, olderDeletion.uuid]);
  });
});

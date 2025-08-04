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
});

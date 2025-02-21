import { Site } from "@terramatch-microservices/database/entities";
import { Test } from "@nestjs/testing";
import { MediaService } from "@terramatch-microservices/common/media/media.service";
import { createMock } from "@golevelup/ts-jest";
import { EntitiesService } from "../entities.service";
import { SiteProcessor } from "./site.processor";
import { reverse, sortBy } from "lodash";
import { EntityQueryDto } from "../dto/entity-query.dto";
import { ProjectFactory, ProjectUserFactory, SiteFactory, UserFactory } from "@terramatch-microservices/database/factories";
import { buildJsonApi } from "@terramatch-microservices/common/util";
import { SiteLightDto } from "../dto/site.dto";

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
      query: EntityQueryDto,
      {
        permissions = ["sites-read"],
        sortField = "id",
        sortUp = true,
        total = expected.length
      }: { permissions?: string[]; sortField?: string; sortUp?: boolean; total?: number } = {}
    ) {
      const { models, paginationTotal } = await processor.findMany(query, userId, permissions);
      expect(models.length).toBe(expected.length);
      expect(paginationTotal).toBe(total);

      const sorted = sortBy(expected, sortField);
      if (!sortUp) reverse(sorted);
      expect(models.map(({ id }) => id)).toEqual(sorted.map(({ id }) => id));
    }

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
    it("includes calculated fields in SiteLightDto", async () => {
      const project = await ProjectFactory.create();

      const { uuid } = await SiteFactory.create({
        projectId: project.id
      });

      const { models } = await processor.findMany({}, userId, ["sites-read"]);
      const document = buildJsonApi(SiteLightDto, { forceDataArray: true });
      await processor.addLightDto(document, models[0]);
      const attributes = document.serialize().data[0].attributes as SiteLightDto;
      expect(attributes).toMatchObject({
        uuid,
        lightResource: true,
        projectName: project.name
      });
    });
  });
});

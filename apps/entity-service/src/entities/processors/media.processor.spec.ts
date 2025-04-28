import { EntitiesService } from "../entities.service";
import { MediaService } from "@terramatch-microservices/common/media/media.service";
import { createMock } from "@golevelup/ts-jest";
import { Test, TestingModule } from "@nestjs/testing";
import { PolicyService } from "@terramatch-microservices/common/policies/policy.service";
import { LocalizationService } from "@terramatch-microservices/common/localization/localization.service";
import {
  MediaFactory,
  ProjectFactory,
  SiteFactory,
  NurseryFactory,
  ProjectReportFactory,
  SiteReportFactory
} from "@terramatch-microservices/database/factories";
import { buildJsonApi, DocumentBuilder, getStableRequestQuery, Resource } from "@terramatch-microservices/common/util";
import { MediaDto } from "../dto/media.dto";
import { MediaProcessor } from "./media.processor";
import { Media } from "@terramatch-microservices/database/entities";
import { EntityType } from "@terramatch-microservices/database/constants/entities";
import { MediaQueryDto } from "../dto/media-query.dto";

describe("MediaProcessor", () => {
  let processor: MediaProcessor;
  let module: TestingModule;

  async function expectMediasEntries(
    response: Media[],
    entityType: EntityType,
    entityUuid: string,
    query: object = {}
  ) {
    await processor.getAssociations();
    const document = buildJsonApi(MediaDto, { forceDataArray: true });
    await processor.addDtos(document);
    const result = document.serialize();

    const data = result.data as Resource[];
    expect(data.length).toEqual(response.length);

    response.forEach(({ uuid }) => {
      const dto = data.find(({ id }) => id === uuid)?.attributes as unknown as MediaDto;
      expect(dto).not.toBeNull();
    });

    expect(result.meta.indices[0]).toMatchObject({
      resource: "media",
      requestPath: `/entities/v3/${entityType}/${entityUuid}/media${getStableRequestQuery(query)}`,
      ids: response.map(({ uuid }) => uuid)
    });
  }

  beforeEach(async () => {
    module = await Test.createTestingModule({
      providers: [
        { provide: MediaService, useValue: createMock<MediaService>() },
        { provide: PolicyService, useValue: createMock<PolicyService>() },
        { provide: LocalizationService, useValue: createMock<LocalizationService>() },
        EntitiesService
      ]
    }).compile();
  });

  afterEach(async () => {
    jest.resetAllMocks();
    await Media.truncate();
  });

  describe("addDtos", () => {
    it("should include media entries for the project associated to the processor at creation", async () => {
      const project = await ProjectFactory.create();
      const media = await MediaFactory.forProject.create({ modelId: project.id });

      processor = module
        .get(EntitiesService)
        .createAssociationProcessor("projects", project.uuid, "media", {}) as MediaProcessor;

      await expectMediasEntries([media], "projects", project.uuid);
    });

    it("should include media entries for the site associated to the processor at creation", async () => {
      const site = await SiteFactory.create();
      const media = await MediaFactory.forSite.create({ modelId: site.id });

      processor = module
        .get(EntitiesService)
        .createAssociationProcessor("sites", site.uuid, "media", {}) as MediaProcessor;

      await expectMediasEntries([media], "sites", site.uuid);
    });

    it("should include media entries for the nursery associated to the processor at creation", async () => {
      const nursery = await NurseryFactory.create();
      const media = await MediaFactory.forNursery.create({ modelId: nursery.id });

      processor = module
        .get(EntitiesService)
        .createAssociationProcessor("nurseries", nursery.uuid, "media", {}) as MediaProcessor;

      await expectMediasEntries([media], "nurseries", nursery.uuid);
    });

    it("should include media entries for the project report associated to the processor at creation", async () => {
      const projectReport = await ProjectReportFactory.create();
      const media = await MediaFactory.forProjectReport.create({ modelId: projectReport.id });

      processor = module
        .get(EntitiesService)
        .createAssociationProcessor("projectReports", projectReport.uuid, "media", {}) as MediaProcessor;

      await expectMediasEntries([media], "projectReports", projectReport.uuid);
    });

    it("should include media entries for the site report associated to the processor at creation", async () => {
      const siteReport = await SiteReportFactory.create();
      const media = await MediaFactory.forSiteReport.create({ modelId: siteReport.id });

      processor = module
        .get(EntitiesService)
        .createAssociationProcessor("siteReports", siteReport.uuid, "media", {}) as MediaProcessor;

      await expectMediasEntries([media], "siteReports", siteReport.uuid);
    });
  });

  describe("it filters", () => {
    it("should filter by isGeotagged", async () => {
      const project = await ProjectFactory.create();
      const media = await MediaFactory.forProject.create({ modelId: project.id, lat: 1, lng: 1 });
      await MediaFactory.forProject.create({ modelId: project.id });

      const query: MediaQueryDto = { isGeotagged: true };

      processor = module
        .get(EntitiesService)
        .createAssociationProcessor("projects", project.uuid, "media", query) as MediaProcessor;

      await expectMediasEntries([media], "projects", project.uuid, query);
    });

    it("should filter by isPublic", async () => {
      const project = await ProjectFactory.create();
      const media = await MediaFactory.forProject.create({ modelId: project.id, isPublic: true });
      await MediaFactory.forProject.create({ modelId: project.id, isPublic: false });

      const query: MediaQueryDto = { isPublic: true };

      processor = module
        .get(EntitiesService)
        .createAssociationProcessor("projects", project.uuid, "media", query) as MediaProcessor;

      await expectMediasEntries([media], "projects", project.uuid, query);
    });

    it("should filter by fileType", async () => {
      const project = await ProjectFactory.create();
      const media = await MediaFactory.forProject.create({ modelId: project.id, fileType: "document" });
      await MediaFactory.forProject.create({ modelId: project.id });

      const query: MediaQueryDto = { fileType: media.fileType };

      processor = module
        .get(EntitiesService)
        .createAssociationProcessor("projects", project.uuid, "media", query) as MediaProcessor;

      await expectMediasEntries([media], "projects", project.uuid, query);
    });
  });

  describe("it sorts", () => {
    it("should sort by ascending", async () => {
      const project = await ProjectFactory.create();
      const media = await MediaFactory.forProject.create({ modelId: project.id, createdAt: new Date("2025-01-01") });
      const media2 = await MediaFactory.forProject.create({ modelId: project.id, createdAt: new Date("2025-01-02") });

      const query: MediaQueryDto = { direction: "ASC" };

      processor = module
        .get(EntitiesService)
        .createAssociationProcessor("projects", project.uuid, "media", query) as MediaProcessor;

      await expectMediasEntries([media, media2], "projects", project.uuid, query);
    });

    it("should sort by descending", async () => {
      const project = await ProjectFactory.create();
      const media = await MediaFactory.forProject.create({ modelId: project.id, createdAt: new Date("2025-01-01") });
      const media2 = await MediaFactory.forProject.create({ modelId: project.id, createdAt: new Date("2025-01-02") });

      const query: MediaQueryDto = { direction: "DESC" };

      processor = module
        .get(EntitiesService)
        .createAssociationProcessor("projects", project.uuid, "media", query) as MediaProcessor;

      await expectMediasEntries([media2, media], "projects", project.uuid, query);
    });
  });
});

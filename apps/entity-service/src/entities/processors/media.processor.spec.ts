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
  SiteReportFactory,
  NurseryReportFactory
} from "@terramatch-microservices/database/factories";
import { buildJsonApi, getStableRequestQuery, Resource } from "@terramatch-microservices/common/util";
import { MediaDto } from "@terramatch-microservices/common/dto/media.dto";
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

    expect(result.meta.indices?.[0]).toMatchObject({
      resource: "media",
      requestPath: `/entities/v3/${entityType}/${entityUuid}/media${getStableRequestQuery(query)}`,
      ids: undefined
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
      const media = await MediaFactory.project(project).create();

      processor = module
        .get(EntitiesService)
        .createAssociationProcessor("projects", project.uuid, "media", {}) as MediaProcessor;

      await expectMediasEntries([media], "projects", project.uuid);
    });

    it("should include media entries for the site associated to the processor at creation", async () => {
      const site = await SiteFactory.create();
      const media = await MediaFactory.site(site).create();

      processor = module
        .get(EntitiesService)
        .createAssociationProcessor("sites", site.uuid, "media", {}) as MediaProcessor;

      await expectMediasEntries([media], "sites", site.uuid);
    });

    it("should include media entries for the nursery associated to the processor at creation", async () => {
      const nursery = await NurseryFactory.create();
      const media = await MediaFactory.nursery(nursery).create();

      processor = module
        .get(EntitiesService)
        .createAssociationProcessor("nurseries", nursery.uuid, "media", {}) as MediaProcessor;

      await expectMediasEntries([media], "nurseries", nursery.uuid);
    });

    it("should include media entries for the project report associated to the processor at creation", async () => {
      const project = await ProjectFactory.create();
      const projectReport = await ProjectReportFactory.create({ projectId: project.id });
      const site = await SiteFactory.create({ projectId: project.id });
      await SiteReportFactory.create({ siteId: site.id, dueAt: projectReport.dueAt });
      const nursery = await NurseryFactory.create({ projectId: project.id });
      await NurseryReportFactory.create({ nurseryId: nursery.id, dueAt: projectReport.dueAt });
      const media = await MediaFactory.projectReport(projectReport).create();

      processor = module
        .get(EntitiesService)
        .createAssociationProcessor("projectReports", projectReport.uuid, "media", {}) as MediaProcessor;

      await expectMediasEntries([media], "projectReports", projectReport.uuid);
    });

    it("should include media entries for the site report associated to the processor at creation", async () => {
      const siteReport = await SiteReportFactory.create();
      const media = await MediaFactory.siteReport(siteReport).create();

      processor = module
        .get(EntitiesService)
        .createAssociationProcessor("siteReports", siteReport.uuid, "media", {}) as MediaProcessor;

      await expectMediasEntries([media], "siteReports", siteReport.uuid);
    });
  });

  describe("it filters", () => {
    it("should filter by isGeotagged", async () => {
      const project = await ProjectFactory.create();
      const media = await MediaFactory.project(project).create({ lat: 1, lng: 1 });
      await MediaFactory.project(project).create();

      const query: MediaQueryDto = { isGeotagged: true };

      processor = module
        .get(EntitiesService)
        .createAssociationProcessor("projects", project.uuid, "media", query) as MediaProcessor;

      await expectMediasEntries([media], "projects", project.uuid, query);
    });

    it("should filter by isGeotagged false", async () => {
      const project = await ProjectFactory.create();
      await MediaFactory.project(project).create({ lat: 1, lng: 1 });
      const media = await MediaFactory.project(project).create();

      const query: MediaQueryDto = { isGeotagged: false };

      processor = module
        .get(EntitiesService)
        .createAssociationProcessor("projects", project.uuid, "media", query) as MediaProcessor;

      await expectMediasEntries([media], "projects", project.uuid, query);
    });

    it("should filter by isPublic", async () => {
      const project = await ProjectFactory.create();
      const media = await MediaFactory.project(project).create({ isPublic: true });
      await MediaFactory.project(project).create({ isPublic: false });

      const query: MediaQueryDto = { isPublic: true };

      processor = module
        .get(EntitiesService)
        .createAssociationProcessor("projects", project.uuid, "media", query) as MediaProcessor;

      await expectMediasEntries([media], "projects", project.uuid, query);
    });

    it("should filter by fileType", async () => {
      const project = await ProjectFactory.create();
      const media = await MediaFactory.project(project).create({ fileType: "documents" });
      await MediaFactory.project(project).create();

      const query: MediaQueryDto = { fileType: media.fileType ?? undefined };

      processor = module
        .get(EntitiesService)
        .createAssociationProcessor("projects", project.uuid, "media", query) as MediaProcessor;

      await expectMediasEntries([media], "projects", project.uuid, query);
    });
  });

  describe("it sorts", () => {
    it("should sort by ascending", async () => {
      const project = await ProjectFactory.create();
      const media = await MediaFactory.project(project).create({ createdAt: new Date("2025-01-01") });
      const media2 = await MediaFactory.project(project).create({ createdAt: new Date("2025-01-02") });

      const query: MediaQueryDto = { direction: "ASC" };

      processor = module
        .get(EntitiesService)
        .createAssociationProcessor("projects", project.uuid, "media", query) as MediaProcessor;

      await expectMediasEntries([media, media2], "projects", project.uuid, query);
    });

    it("should sort by descending", async () => {
      const project = await ProjectFactory.create();
      const media = await MediaFactory.project(project).create({ createdAt: new Date("2025-01-01") });
      const media2 = await MediaFactory.project(project).create({ createdAt: new Date("2025-01-02") });

      const query: MediaQueryDto = { direction: "DESC" };

      processor = module
        .get(EntitiesService)
        .createAssociationProcessor("projects", project.uuid, "media", query) as MediaProcessor;

      await expectMediasEntries([media2, media], "projects", project.uuid, query);
    });
  });

  describe("it searches", () => {
    it("should search by fileName", async () => {
      const project = await ProjectFactory.create();

      const search = "test";
      const media = await MediaFactory.project(project).create({ fileName: search });
      await MediaFactory.project(project).create();

      const query: MediaQueryDto = { search };

      processor = module
        .get(EntitiesService)
        .createAssociationProcessor("projects", project.uuid, "media", query) as MediaProcessor;

      await expectMediasEntries([media], "projects", project.uuid, query);
    });
  });
});

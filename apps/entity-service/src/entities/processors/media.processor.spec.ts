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
import { buildJsonApi, DocumentBuilder, Resource } from "@terramatch-microservices/common/util";
import { MediaDto } from "../dto/media.dto";
import { MediaProcessor } from "./media.processor";
import { Media } from "@terramatch-microservices/database/entities";
import { EntityType } from "@terramatch-microservices/database/constants/entities";

describe("MediaProcessor", () => {
  let processor: MediaProcessor;
  let module: TestingModule;

  function expectMediasEntries(
    response: Media[],
    entityType: EntityType,
    entityUuid: string,
    document: DocumentBuilder
  ) {
    const result = document.serialize();

    const data = result.data as Resource[];
    expect(data.length).toEqual(response.length);

    response.forEach(({ uuid }) => {
      const dto = data.find(({ id }) => id === uuid)?.attributes as unknown as MediaDto;
      expect(dto).not.toBeNull();
    });

    expect(result.meta.indices[0]).toMatchObject({
      resource: "media",
      requestPath: `/entities/v3/${entityType}/${entityUuid}/media`,
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
      processor = module
        .get(EntitiesService)
        .createAssociationProcessor("projects", project.uuid, "media", {}) as MediaProcessor;

      const media = await MediaFactory.forProject.create({ modelId: project.id });
      await processor.getAssociations();
      const document = buildJsonApi(MediaDto, { forceDataArray: true });
      await processor.addDtos(document);

      expectMediasEntries([media], "projects", project.uuid, document);
    });

    it("should include media entries for the site associated to the processor at creation", async () => {
      const site = await SiteFactory.create();
      processor = module
        .get(EntitiesService)
        .createAssociationProcessor("sites", site.uuid, "media", {}) as MediaProcessor;

      const media = await MediaFactory.forSite.create({ modelId: site.id });
      await processor.getAssociations();
      const document = buildJsonApi(MediaDto, { forceDataArray: true });
      await processor.addDtos(document);

      expectMediasEntries([media], "sites", site.uuid, document);
    });

    it("should include media entries for the nursery associated to the processor at creation", async () => {
      const nursery = await NurseryFactory.create();
      processor = module
        .get(EntitiesService)
        .createAssociationProcessor("nurseries", nursery.uuid, "media", {}) as MediaProcessor;

      const media = await MediaFactory.forNursery.create({ modelId: nursery.id });
      await processor.getAssociations();
      const document = buildJsonApi(MediaDto, { forceDataArray: true });

      await processor.addDtos(document);

      expectMediasEntries([media], "nurseries", nursery.uuid, document);
    });

    it("should include media entries for the project report associated to the processor at creation", async () => {
      const projectReport = await ProjectReportFactory.create();
      processor = module
        .get(EntitiesService)
        .createAssociationProcessor("projectReports", projectReport.uuid, "media", {}) as MediaProcessor;

      const media = await MediaFactory.forProjectReport.create({ modelId: projectReport.id });
      await processor.getAssociations();
      const document = buildJsonApi(MediaDto, { forceDataArray: true });
      await processor.addDtos(document);

      expectMediasEntries([media], "projectReports", projectReport.uuid, document);
    });

    it("should include media entries for the site report associated to the processor at creation", async () => {
      const siteReport = await SiteReportFactory.create();
      processor = module
        .get(EntitiesService)
        .createAssociationProcessor("siteReports", siteReport.uuid, "media", {}) as MediaProcessor;

      const media = await MediaFactory.forSiteReport.create({ modelId: siteReport.id });
      await processor.getAssociations();
      const document = buildJsonApi(MediaDto, { forceDataArray: true });
      await processor.addDtos(document);

      expectMediasEntries([media], "siteReports", siteReport.uuid, document);
    });
  });
});

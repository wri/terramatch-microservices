import { EntitiesService, ProcessableAssociation, ProcessableEntity } from "./entities.service";
import { MediaService } from "@terramatch-microservices/common/media/media.service";
import { DeepMocked } from "@golevelup/ts-jest";
import { BadRequestException } from "@nestjs/common";
import { Media, Project } from "@terramatch-microservices/database/entities";
import { MediaFactory, ProjectFactory } from "@terramatch-microservices/database/factories";
import { pickApiProperties } from "@terramatch-microservices/common/dto/json-api-attributes";
import { MediaDto } from "@terramatch-microservices/common/dto/media.dto";
import { EntityQueryDto } from "./dto/entity-query.dto";
import { EntityType } from "@terramatch-microservices/database/constants/entities";
import { MediaOwnerType } from "@terramatch-microservices/database/constants/media-owners";
import { MediaOwnerProcessor } from "./processors/media-owner-processor";
import { ConfigService } from "@nestjs/config";
import { CsvExportService } from "@terramatch-microservices/common/export/csv-export.service";
import { mockEntityService } from "./processors/entity.processor.spec";
import { FrameworkKey } from "@terramatch-microservices/database/constants";
import { PaginatedQueryBuilder } from "@terramatch-microservices/common/util/paginated-query.builder";

describe("EntitiesService", () => {
  let mediaService: DeepMocked<MediaService>;
  let csvExportService: DeepMocked<CsvExportService>;
  let service: EntitiesService;

  function expectMediaMatchesDto(dto: object, media: Media) {
    expect(dto).toMatchObject({
      ...pickApiProperties(media, MediaDto),
      url: service.fullUrl(media),
      thumbUrl: service.thumbnailUrl(media),
      createdAt: media.createdAt
    });
  }

  beforeEach(async () => {
    const module = await mockEntityService();
    service = module.get(EntitiesService);
    mediaService = module.get(MediaService);
    mediaService.getUrl.mockImplementation(
      ({ fileName }, conversion: string) => `https://example.com/${conversion ?? ""}/${fileName}`
    );
    csvExportService = module.get(CsvExportService);
    const configService: DeepMocked<ConfigService> = module.get(ConfigService);
    configService.get.mockImplementation((key: string) => (key === "DEPLOY_ENV" ? "prod" : ""));
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("isProd", () => {
    it("returns true for prod", () => {
      expect(service.isProd).toBe(true);
    });
  });

  describe("createProcessor", () => {
    it("throws with an unknown entity type", async () => {
      expect(() => service.createEntityProcessor("foo" as ProcessableEntity)).toThrow(BadRequestException);
    });
  });

  describe("createAssociationProcessor", () => {
    it("throws with an unknown association type", async () => {
      expect(() => service.createAssociationProcessor("projectReports", "", "bar" as ProcessableAssociation)).toThrow(
        BadRequestException
      );
    });

    it("throws with an unknown entity type", async () => {
      expect(() => service.createAssociationProcessor("foo" as EntityType, "", "trackings")).toThrow(
        BadRequestException
      );
    });
  });

  describe("createMediaOwnerProcessor", () => {
    it("throws with an unknown media owner type", async () => {
      expect(() => service.createMediaOwnerProcessor("foo" as MediaOwnerType, "bar")).toThrow(BadRequestException);
    });

    it("returns a MediaOwnerProcessor", async () => {
      const processor = service.createMediaOwnerProcessor("projects", "123");
      expect(processor).toBeInstanceOf(MediaOwnerProcessor);
    });
  });

  describe("buildQuery", () => {
    it("throws with invalid page info", async () => {
      await expect(service.buildQuery(Project, { page: { size: 10000 } } as EntityQueryDto)).rejects.toThrow(
        BadRequestException
      );
      await expect(service.buildQuery(Project, { page: { size: 0 } } as EntityQueryDto)).rejects.toThrow(
        BadRequestException
      );
      await expect(service.buildQuery(Project, { page: { number: 0 } } as EntityQueryDto)).rejects.toThrow(
        BadRequestException
      );
    });
  });

  describe("mediaMethods", () => {
    it("returns complete URLs", async () => {
      const media = { fileName: "foo.jpg" } as Media;
      expect(service.fullUrl(media)).toEqual("https://example.com//foo.jpg");
      expect(service.thumbnailUrl(media)).toEqual("https://example.com/thumbnail/foo.jpg");
    });
  });

  describe("mapMediaCollection", () => {
    it("maps a MediaCollection to a dto mapping", async () => {
      const project = await ProjectFactory.create();
      const media = [
        await MediaFactory.project(project).create({
          collectionName: Project.MEDIA.otherAdditionalDocuments.dbCollection
        })
      ];
      media.push(
        await MediaFactory.project(project).create({
          collectionName: Project.MEDIA.detailedProjectBudget.dbCollection
        })
      );
      const result = service.mapMediaCollection(media, Project.MEDIA, "projects", project.uuid);
      expect(Object.keys(result)).toMatchObject(Object.keys(Project.MEDIA));
      // multi media
      expectMediaMatchesDto(result["otherAdditionalDocuments"][0], media[0]);
      // non multi media
      expectMediaMatchesDto(result["detailedProjectBudget"], media[1]);
    });
  });

  describe("entityFrameworkExport", () => {
    it("throws if the framework key is missing", async () => {
      await expect(
        service.entityFrameworkExport("projects", {}, [], {} as PaginatedQueryBuilder<Project>, {})
      ).rejects.toThrowError("Framework key is required for entity export");
    });

    it("returns early if the form is missing", async () => {
      await service.entityFrameworkExport("projects", {}, [], {} as PaginatedQueryBuilder<Project>, {
        frameworkKey: "foo" as FrameworkKey
      });
      expect(csvExportService.getS3StreamWriter).not.toHaveBeenCalled();
    });
  });
});

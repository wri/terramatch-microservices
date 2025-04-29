import { EntitiesService, ProcessableAssociation, ProcessableEntity } from "./entities.service";
import { Test } from "@nestjs/testing";
import { MediaService } from "@terramatch-microservices/common/media/media.service";
import { createMock, DeepMocked } from "@golevelup/ts-jest";
import { BadRequestException } from "@nestjs/common";
import { Media, Project } from "@terramatch-microservices/database/entities";
import { MediaFactory } from "@terramatch-microservices/database/factories";
import { pickApiProperties } from "@terramatch-microservices/common/dto/json-api-attributes";
import { MediaDto } from "./dto/media.dto";
import { EntityQueryDto } from "./dto/entity-query.dto";
import { EntityType } from "@terramatch-microservices/database/constants/entities";
import { PolicyService } from "@terramatch-microservices/common";
import { LocalizationService } from "@terramatch-microservices/common/localization/localization.service";

describe("EntitiesService", () => {
  let mediaService: DeepMocked<MediaService>;
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
    const module = await Test.createTestingModule({
      providers: [
        { provide: MediaService, useValue: (mediaService = createMock<MediaService>()) },
        { provide: PolicyService, useValue: createMock<PolicyService>() },
        { provide: LocalizationService, useValue: createMock<LocalizationService>() },
        EntitiesService
      ]
    }).compile();

    service = module.get(EntitiesService);

    mediaService.getUrl.mockImplementation(
      ({ fileName }, conversion: string) => `https://example.com/${conversion ?? ""}/${fileName}`
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
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
      expect(() => service.createAssociationProcessor("foo" as EntityType, "", "demographics")).toThrow(
        BadRequestException
      );
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

    it("returns a valid DTO", async () => {
      const media = await MediaFactory.forProject.create();
      const dto = service.mediaDto(media, {});
      expectMediaMatchesDto(dto, media);
    });
  });

  describe("mapMediaCollection", () => {
    it("maps a MediaCollection to a dto mapping", async () => {
      const media = [
        await MediaFactory.forProject.create({ collectionName: Project.MEDIA.otherAdditionalDocuments.dbCollection })
      ];
      media.push(
        await MediaFactory.forProject.create({ collectionName: Project.MEDIA.detailedProjectBudget.dbCollection })
      );
      const result = service.mapMediaCollection(media, Project.MEDIA);
      expect(Object.keys(result)).toMatchObject(Object.keys(Project.MEDIA));
      // multi media
      expectMediaMatchesDto(result["otherAdditionalDocuments"][0], media[0]);
      // non multi media
      expectMediaMatchesDto(result["detailedProjectBudget"], media[1]);
    });
  });
});

import { EntitiesService } from "../entities.service";
import { MediaService } from "@terramatch-microservices/common/media/media.service";
import { createMock } from "@golevelup/ts-jest";
import { Test } from "@nestjs/testing";
import { PolicyService } from "@terramatch-microservices/common/policies/policy.service";
import { LocalizationService } from "@terramatch-microservices/common/localization/localization.service";
import { MediaFactory, ProjectFactory } from "@terramatch-microservices/database/factories";
import { buildJsonApi, Resource } from "@terramatch-microservices/common/util";
import { MediaDto } from "../dto/media.dto";

describe("MediaProcessor", () => {
  let service: EntitiesService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        { provide: MediaService, useValue: createMock<MediaService>() },
        { provide: PolicyService, useValue: createMock<PolicyService>() },
        { provide: LocalizationService, useValue: createMock<LocalizationService>() },
        EntitiesService
      ]
    }).compile();

    service = module.get(EntitiesService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("addDtos", () => {
    it("should include media entries", async () => {
      const { uuid: projectUuid, id: projectId } = await ProjectFactory.create();
      const { id, uuid } = await MediaFactory.forProject.create({ id: projectId });
      expect(id).toBeDefined();
      expect(uuid).toBeDefined();
      const document = buildJsonApi(MediaDto, { forceDataArray: true });
      await service.createAssociationProcessor("projects", projectUuid, "media").addDtos(document);
      const result = document.serialize();
      expect(result).toMatchObject({
        data: [],
        meta: {
          indices: []
        }
      });
      const data = result.data as Resource[];
      expect(data.length).toEqual(1);

      const dto = data.find(({ id }) => id === uuid)?.attributes as unknown as MediaDto;
      expect(dto).not.toBeNull();

      expect(result.meta.indices[0]).toMatchObject({
        resource: "media",
        requestPath: `/entities/v3/projects/${projectUuid}/media`,
        ids: [uuid]
      });
    });
  });
});

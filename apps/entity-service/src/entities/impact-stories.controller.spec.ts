import { Test, TestingModule } from "@nestjs/testing";
import { ImpactStoriesController } from "./impact-stories.controller";
import { ImpactStoryService } from "./impact-story.service";
import { PolicyService } from "@terramatch-microservices/common";
import { EntitiesService } from "./entities.service";
import { ImpactStory, Media } from "@terramatch-microservices/database/entities";
import { NotFoundException } from "@nestjs/common";
import { JsonApiDocument, Resource } from "@terramatch-microservices/common/util/json-api-builder";
import { ImpactStoryQueryDto } from "./dto/impact-story-query.dto";

describe("ImpactStoriesController", () => {
  let controller: ImpactStoriesController;
  let impactStoryService: ImpactStoryService;
  let policyService: PolicyService;
  let entitiesService: EntitiesService;

  const mockImpactStory = {
    id: 1,
    uuid: "test-uuid",
    title: "Test Story",
    status: "active",
    organizationId: 1,
    date: new Date().toISOString(),
    category: JSON.stringify({ type: "test" }),
    content: "Test content",
    createdAt: new Date(),
    updatedAt: new Date(),
    organisation: {
      id: 1,
      uuid: "org-uuid",
      name: "Test Org",
      type: "test",
      countries: ["US", "UK"]
    }
  } as unknown as ImpactStory;

  const mockMedia = [
    {
      id: 1,
      uuid: "media-uuid",
      modelId: 1,
      modelType: "impact_story",
      modelUuid: "test-uuid",
      collectionName: "media",
      name: "test.jpg",
      url: "test.jpg",
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ] as unknown as Media[];

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ImpactStoriesController],
      providers: [
        {
          provide: ImpactStoryService,
          useValue: {
            getImpactStory: jest.fn(),
            getImpactStories: jest.fn(),
            getMediaForStories: jest.fn(),
            getCountriesForOrganizations: jest.fn()
          }
        },
        {
          provide: PolicyService,
          useValue: {
            authorize: jest.fn()
          }
        },
        {
          provide: EntitiesService,
          useValue: {
            mapMediaCollection: jest.fn()
          }
        }
      ]
    }).compile();

    controller = module.get<ImpactStoriesController>(ImpactStoriesController);
    impactStoryService = module.get<ImpactStoryService>(ImpactStoryService);
    policyService = module.get<PolicyService>(PolicyService);
    entitiesService = module.get<EntitiesService>(EntitiesService);

    // Mock service methods
    jest.spyOn(impactStoryService, "getImpactStory").mockResolvedValue(mockImpactStory);
    jest.spyOn(impactStoryService, "getImpactStories").mockResolvedValue({
      data: [mockImpactStory],
      paginationTotal: 1,
      pageNumber: 1
    });
    jest.spyOn(impactStoryService, "getMediaForStories").mockResolvedValue({
      "test-uuid": mockMedia
    });
    jest.spyOn(impactStoryService, "getCountriesForOrganizations").mockResolvedValue(
      new Map([
        ["US", { label: "United States", icon: "/flags/us.svg" }],
        ["UK", { label: "United Kingdom", icon: "/flags/uk.svg" }]
      ])
    );

    // Mock Media.for().findAll
    jest.spyOn(Media, "for").mockReturnValue({
      findAll: jest.fn().mockResolvedValue(mockMedia)
    } as unknown as ReturnType<typeof Media.for>);

    // Mock entitiesService.mapMediaCollection
    jest.spyOn(entitiesService, "mapMediaCollection").mockReturnValue({
      media: mockMedia
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("impactStoryIndex", () => {
    it("should return paginated impact stories with media and countries", async () => {
      const query: ImpactStoryQueryDto = { page: { number: 1 } };
      const result = (await controller.impactStoryIndex(query)) as JsonApiDocument;

      expect(result).toBeDefined();
      expect(result.data).toBeDefined();
      expect(result.meta).toBeDefined();
      expect(result.meta.indices?.[0].total).toBe(1);
      expect(result.meta.indices?.[0].pageNumber).toBe(1);

      expect(impactStoryService.getImpactStories).toHaveBeenCalledWith(query);
      expect(impactStoryService.getMediaForStories).toHaveBeenCalledWith([mockImpactStory]);
      expect(impactStoryService.getCountriesForOrganizations).toHaveBeenCalledWith([["US", "UK"]]);
      expect(policyService.authorize).toHaveBeenCalledWith("read", [mockImpactStory]);
    });

    it("should handle empty results", async () => {
      jest.spyOn(impactStoryService, "getImpactStories").mockResolvedValue({
        data: [],
        paginationTotal: 0,
        pageNumber: 1
      });

      const query: ImpactStoryQueryDto = { page: { number: 1 } };
      const result = (await controller.impactStoryIndex(query)) as JsonApiDocument;

      expect(result.data).toBeDefined();
      expect(result.meta.indices?.[0].total).toBe(0);
      expect(impactStoryService.getMediaForStories).not.toHaveBeenCalled();
      expect(impactStoryService.getCountriesForOrganizations).not.toHaveBeenCalled();
    });
  });

  describe("impactStoryGet", () => {
    it("should return a single impact story with media and countries", async () => {
      const params = { uuid: "test-uuid" };
      const result = (await controller.impactStoryGet(params)) as JsonApiDocument;

      expect(result).toBeDefined();
      expect(result.data).toBeDefined();
      const resource = result.data as Resource;
      expect(resource.attributes.uuid).toBe("test-uuid");

      expect(impactStoryService.getImpactStory).toHaveBeenCalledWith("test-uuid");
      expect(Media.for).toHaveBeenCalledWith(mockImpactStory);
      expect(impactStoryService.getCountriesForOrganizations).toHaveBeenCalled();
      expect(policyService.authorize).toHaveBeenCalledWith("read", mockImpactStory);
    });

    it("should throw NotFoundException when story not found", async () => {
      jest.spyOn(impactStoryService, "getImpactStory").mockRejectedValue(new NotFoundException());

      const params = { uuid: "non-existent" };
      await expect(controller.impactStoryGet(params)).rejects.toThrow(NotFoundException);
    });
  });
});

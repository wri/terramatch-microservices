import { Test, TestingModule } from "@nestjs/testing";
import { ImpactStoriesController } from "./impact-stories.controller";
import { ImpactStoryService } from "./impact-story.service";
import { EntitiesService } from "./entities.service";
import { ImpactStory, Media } from "@terramatch-microservices/database/entities";
import { BadRequestException, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { Resource } from "@terramatch-microservices/common/util/json-api-builder";
import { ImpactStoryQueryDto } from "./dto/impact-story-query.dto";
import { serialize } from "@terramatch-microservices/common/util/testing";
import { PolicyService } from "@terramatch-microservices/common";
import { CreateImpactStoryBody } from "./dto/create-impact-story.dto";
import { UpdateImpactStoryBody } from "./dto/update-impact-story.dto";
import { ImpactStoryBulkDeleteBodyDto } from "./dto/bulk-delete-impact-stories.dto";

describe("ImpactStoriesController", () => {
  let controller: ImpactStoriesController;
  let impactStoryService: ImpactStoryService;
  let entitiesService: EntitiesService;
  let policyService: PolicyService;

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
            getCountriesForOrganizations: jest.fn(),
            getImpactStoryWithMedia: jest.fn(),
            createImpactStory: jest.fn(),
            updateImpactStory: jest.fn(),
            deleteImpactStory: jest.fn(),
            bulkDeleteImpactStories: jest.fn()
          }
        },
        {
          provide: EntitiesService,
          useValue: {
            mapMediaCollection: jest.fn()
          }
        },
        {
          provide: PolicyService,
          useValue: {
            authorize: jest.fn(),
            getPermissions: jest.fn()
          }
        }
      ]
    }).compile();

    controller = module.get<ImpactStoriesController>(ImpactStoriesController);
    impactStoryService = module.get<ImpactStoryService>(ImpactStoryService);
    entitiesService = module.get<EntitiesService>(EntitiesService);
    policyService = module.get<PolicyService>(PolicyService);

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

    jest.spyOn(impactStoryService, "getImpactStoryWithMedia").mockResolvedValue({
      impactStory: mockImpactStory,
      mediaCollection: mockMedia,
      organization: {
        uuid: "org-uuid",
        name: "Test Org",
        type: "test",
        countries: [
          { label: "United States", icon: "/flags/us.svg" },
          { label: "United Kingdom", icon: "/flags/uk.svg" }
        ],
        webUrl: null,
        facebookUrl: null,
        instagramUrl: null,
        linkedinUrl: null,
        twitterUrl: null
      }
    });

    jest.spyOn(Media, "for").mockReturnValue({
      findAll: jest.fn().mockResolvedValue(mockMedia)
    } as unknown as ReturnType<typeof Media.for>);

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
      const result = serialize(await controller.impactStoryIndex(query));

      expect(result).toBeDefined();
      expect(result.data).toBeDefined();
      expect(result.meta).toBeDefined();
      expect(result.meta.indices?.[0].total).toBe(1);
      expect(result.meta.indices?.[0].pageNumber).toBe(1);

      expect(impactStoryService.getImpactStories).toHaveBeenCalledWith(query);
      expect(impactStoryService.getMediaForStories).toHaveBeenCalledWith([mockImpactStory]);
      expect(impactStoryService.getCountriesForOrganizations).toHaveBeenCalledWith([["US", "UK"]]);
    });

    it("should handle empty results", async () => {
      jest.spyOn(impactStoryService, "getImpactStories").mockResolvedValue({
        data: [],
        paginationTotal: 0,
        pageNumber: 1
      });

      const query: ImpactStoryQueryDto = { page: { number: 1 } };
      const result = serialize(await controller.impactStoryIndex(query));

      expect(result.data).toBeDefined();
      expect(result.meta.indices?.[0].total).toBe(0);
      expect(impactStoryService.getMediaForStories).not.toHaveBeenCalled();
      expect(impactStoryService.getCountriesForOrganizations).not.toHaveBeenCalled();
    });
  });

  describe("impactStoryGet", () => {
    it("should return a single impact story with media and countries", async () => {
      const params = { uuid: "test-uuid" };
      const result = serialize(await controller.impactStoryGet(params));

      expect(result).toBeDefined();
      expect(result.data).toBeDefined();
      const resource = result.data as Resource;
      expect(resource.attributes.uuid).toBe("test-uuid");

      expect(impactStoryService.getImpactStoryWithMedia).toHaveBeenCalledWith("test-uuid", true);
    });

    it("should throw NotFoundException when story not found", async () => {
      jest.spyOn(impactStoryService, "getImpactStoryWithMedia").mockRejectedValue(new NotFoundException());

      const params = { uuid: "non-existent" };
      await expect(controller.impactStoryGet(params)).rejects.toThrow(NotFoundException);
    });
  });

  describe("impactStoryCreate", () => {
    it("should create a new impact story", async () => {
      jest.spyOn(policyService, "authorize").mockResolvedValue(undefined);
      jest.spyOn(impactStoryService, "createImpactStory").mockResolvedValue(mockImpactStory);

      const createRequest: CreateImpactStoryBody = {
        data: {
          type: "impactStories",
          attributes: {
            title: "New Story",
            status: "draft",
            organizationUuid: "org-uuid",
            date: "2024-01-01",
            category: ["environment"],
            content: "New content"
          }
        }
      };

      const result = serialize(await controller.impactStoryCreate(createRequest));

      expect(result).toBeDefined();
      expect(result.data).toBeDefined();
      expect(policyService.authorize).toHaveBeenCalledWith("create", ImpactStory);
      expect(impactStoryService.createImpactStory).toHaveBeenCalledWith(createRequest.data.attributes);
      expect(impactStoryService.getImpactStoryWithMedia).toHaveBeenCalledWith("test-uuid", true);
    });

    it("should throw UnauthorizedException when not authorized", async () => {
      jest.spyOn(policyService, "authorize").mockRejectedValue(new UnauthorizedException());

      const createRequest: CreateImpactStoryBody = {
        data: {
          type: "impactStories",
          attributes: {
            title: "New Story",
            status: "draft",
            organizationUuid: "org-uuid"
          }
        }
      };

      await expect(controller.impactStoryCreate(createRequest)).rejects.toThrow(UnauthorizedException);
    });
  });

  describe("impactStoryUpdate", () => {
    it("should update an existing impact story", async () => {
      jest.spyOn(policyService, "authorize").mockResolvedValue(undefined);
      jest.spyOn(impactStoryService, "updateImpactStory").mockResolvedValue(mockImpactStory);

      const updateRequest: UpdateImpactStoryBody = {
        data: {
          type: "impactStories",
          id: "test-uuid",
          attributes: {
            status: "published",
            title: "Updated Story"
          }
        }
      };

      const result = serialize(await controller.impactStoryUpdate({ uuid: "test-uuid" }, updateRequest));

      expect(result).toBeDefined();
      expect(result.data).toBeDefined();
      expect(policyService.authorize).toHaveBeenCalledWith("update", mockImpactStory);
      expect(impactStoryService.updateImpactStory).toHaveBeenCalledWith("test-uuid", updateRequest.data.attributes);
      expect(impactStoryService.getImpactStoryWithMedia).toHaveBeenCalledWith("test-uuid", true);
    });

    it("should throw BadRequestException when UUID mismatch", async () => {
      const updateRequest: UpdateImpactStoryBody = {
        data: {
          type: "impactStories",
          id: "different-uuid",
          attributes: {
            status: "published"
          }
        }
      };

      await expect(controller.impactStoryUpdate({ uuid: "test-uuid" }, updateRequest)).rejects.toThrow(
        BadRequestException
      );
    });

    it("should throw UnauthorizedException when not authorized", async () => {
      jest.spyOn(policyService, "authorize").mockRejectedValue(new UnauthorizedException());

      const updateRequest: UpdateImpactStoryBody = {
        data: {
          type: "impactStories",
          id: "test-uuid",
          attributes: {
            status: "published"
          }
        }
      };

      await expect(controller.impactStoryUpdate({ uuid: "test-uuid" }, updateRequest)).rejects.toThrow(
        UnauthorizedException
      );
    });
  });

  describe("impactStoryDelete", () => {
    it("should delete an impact story", async () => {
      jest.spyOn(policyService, "authorize").mockResolvedValue(undefined);
      jest.spyOn(impactStoryService, "deleteImpactStory").mockResolvedValue(undefined);

      const result = serialize(await controller.impactStoryDelete({ uuid: "test-uuid" }));

      expect(result).toBeDefined();
      expect(result.meta).toBeDefined();
      expect(result.meta.resourceIds).toEqual(["test-uuid"]);
      expect(result.meta.resourceType).toBe("impactStories");
      expect(policyService.authorize).toHaveBeenCalledWith("delete", mockImpactStory);
      expect(impactStoryService.deleteImpactStory).toHaveBeenCalledWith("test-uuid");
    });

    it("should throw UnauthorizedException when not authorized", async () => {
      jest.spyOn(policyService, "authorize").mockRejectedValue(new UnauthorizedException());

      await expect(controller.impactStoryDelete({ uuid: "test-uuid" })).rejects.toThrow(UnauthorizedException);
    });

    it("should throw NotFoundException when story not found", async () => {
      jest.spyOn(policyService, "authorize").mockResolvedValue(undefined);
      jest.spyOn(impactStoryService, "getImpactStory").mockRejectedValue(new NotFoundException());

      await expect(controller.impactStoryDelete({ uuid: "non-existent" })).rejects.toThrow(NotFoundException);
    });
  });

  describe("impactStoryBulkDelete", () => {
    it("should bulk delete impact stories as admin", async () => {
      jest.spyOn(policyService, "authorize").mockResolvedValue(undefined);
      jest.spyOn(impactStoryService, "bulkDeleteImpactStories").mockResolvedValue(["uuid1", "uuid2"]);

      const deleteRequest: ImpactStoryBulkDeleteBodyDto = {
        data: [
          { type: "impactStories", id: "uuid1" },
          { type: "impactStories", id: "uuid2" }
        ]
      };

      const result = serialize(await controller.impactStoryBulkDelete(deleteRequest));

      expect(result).toBeDefined();
      expect(result.meta).toBeDefined();
      expect(result.meta.resourceIds).toEqual(["uuid1", "uuid2"]);
      expect(result.meta.resourceType).toBe("impactStories");
      expect(policyService.authorize).toHaveBeenCalledWith("bulkDelete", ImpactStory);
      expect(impactStoryService.bulkDeleteImpactStories).toHaveBeenCalledWith(["uuid1", "uuid2"]);
    });

    it("should throw UnauthorizedException when not admin", async () => {
      jest.spyOn(policyService, "authorize").mockRejectedValue(new UnauthorizedException());

      const deleteRequest: ImpactStoryBulkDeleteBodyDto = {
        data: [{ type: "impactStories", id: "uuid1" }]
      };

      await expect(controller.impactStoryBulkDelete(deleteRequest)).rejects.toThrow(UnauthorizedException);
    });

    it("should throw BadRequestException when empty UUID list", async () => {
      jest.spyOn(policyService, "authorize").mockResolvedValue(undefined);
      jest
        .spyOn(impactStoryService, "bulkDeleteImpactStories")
        .mockRejectedValue(new BadRequestException("At least one impact story UUID must be provided"));

      const deleteRequest: ImpactStoryBulkDeleteBodyDto = {
        data: []
      };

      await expect(controller.impactStoryBulkDelete(deleteRequest)).rejects.toThrow(BadRequestException);
    });

    it("should throw NotFoundException when stories not found", async () => {
      jest.spyOn(policyService, "authorize").mockResolvedValue(undefined);
      jest
        .spyOn(impactStoryService, "bulkDeleteImpactStories")
        .mockRejectedValue(new NotFoundException("Impact stories not found"));

      const deleteRequest: ImpactStoryBulkDeleteBodyDto = {
        data: [{ type: "impactStories", id: "non-existent" }]
      };

      await expect(controller.impactStoryBulkDelete(deleteRequest)).rejects.toThrow(NotFoundException);
    });
  });
});

import { Test, TestingModule } from "@nestjs/testing";
import { createMock, DeepMocked } from "@golevelup/ts-jest";
import { DashboardImpactStoryProcessor } from "./dashboard-impact-story.processor";
import { CacheService } from "../dto/cache.service";
import { PolicyService } from "@terramatch-microservices/common";
import { MediaService } from "@terramatch-microservices/common/media/media.service";
import { ImpactStory, Media } from "@terramatch-microservices/database/entities";
import { DashboardImpactStoryLightDto } from "../dto/dashboard-impact-story.dto";
import { DashboardQueryDto } from "../dto/dashboard-query.dto";
import { Op } from "sequelize";

describe("DashboardImpactStoryProcessor", () => {
  let processor: DashboardImpactStoryProcessor;
  let cacheService: DeepMocked<CacheService>;
  let policyService: DeepMocked<PolicyService>;
  let mediaService: DeepMocked<MediaService>;

  beforeEach(async () => {
    cacheService = createMock<CacheService>();
    policyService = createMock<PolicyService>();
    mediaService = createMock<MediaService>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: DashboardImpactStoryProcessor,
          useFactory: () => new DashboardImpactStoryProcessor(cacheService, policyService, mediaService)
        },
        {
          provide: CacheService,
          useValue: cacheService
        },
        {
          provide: PolicyService,
          useValue: policyService
        },
        {
          provide: MediaService,
          useValue: mediaService
        }
      ]
    }).compile();

    processor = module.get<DashboardImpactStoryProcessor>(DashboardImpactStoryProcessor);
  });

  it("should have correct DTO types", () => {
    expect(processor.LIGHT_DTO).toBe(DashboardImpactStoryLightDto);
    expect(processor.FULL_DTO).toBe(DashboardImpactStoryLightDto);
  });

  it("should find one impact story by UUID", async () => {
    const mockStory = { uuid: "test-uuid", title: "Test Story" } as ImpactStory;

    jest.spyOn(ImpactStory, "findOne").mockResolvedValue(mockStory);

    const result = await processor.findOne("test-uuid");

    expect(ImpactStory.findOne).toHaveBeenCalledWith({
      where: { uuid: "test-uuid" },
      include: [
        {
          association: "organisation",
          attributes: ["uuid", "name", "type", "countries"]
        }
      ]
    });
    expect(result).toBe(mockStory);
  });

  it("should find many impact stories with country filter", async () => {
    const mockStories = [
      { uuid: "uuid-1", title: "Story 1" } as ImpactStory,
      { uuid: "uuid-2", title: "Story 2" } as ImpactStory
    ];
    const query: DashboardQueryDto = { country: "Kenya" };

    jest.spyOn(ImpactStory, "findAll").mockResolvedValue(mockStories);

    const result = await processor.findMany(query);

    expect(ImpactStory.findAll).toHaveBeenCalledWith({
      where: {},
      include: [
        {
          association: "organisation",
          attributes: ["uuid", "name", "type", "countries", "facebookUrl", "instagramUrl", "linkedinUrl", "twitterUrl"],
          where: { countries: { [Op.like]: '%"Kenya"%' } }
        }
      ],
      order: [["id", "ASC"]]
    });
    expect(result).toBe(mockStories);
  });

  it("should find many impact stories with organisation type filter", async () => {
    const mockStories = [{ uuid: "uuid-1", title: "Story 1" } as ImpactStory];
    const query: DashboardQueryDto = { organisationType: ["NGO"] };

    jest.spyOn(ImpactStory, "findAll").mockResolvedValue(mockStories);

    const result = await processor.findMany(query);

    expect(ImpactStory.findAll).toHaveBeenCalledWith({
      where: {},
      include: [
        {
          association: "organisation",
          attributes: ["uuid", "name", "type", "countries", "facebookUrl", "instagramUrl", "linkedinUrl", "twitterUrl"],
          where: { type: { [Op.in]: ["NGO"] } }
        }
      ],
      order: [["id", "ASC"]]
    });
    expect(result).toBe(mockStories);
  });

  it("should create light DTO with organization data", async () => {
    const mockStory = {
      id: 1,
      uuid: "6c6ee6d2-22e4-49d5-900d-53218867bf48",
      title: "Restoring Land, Empowering Farmers",
      date: "2025-02-21",
      category: ["livelihoods-strengthening", "business-dev-fund", "gender-equity"],
      status: "published",
      organisation: {
        name: "Farmlife Health Services",
        countries: ["KEN"],
        facebookUrl: "https://www.facebook.com/people/FarmLife-Health-Services-Ltd/100064171684456/?mibextid=ZbWKwL",
        instagramUrl: null,
        linkedinUrl: "https://www.linkedin.com/company/69225296/admin/feed/posts/",
        twitterUrl: null
      }
    } as unknown as ImpactStory;

    const mockMedia = [{ id: 1, modelId: 1 }] as Media[];
    jest.spyOn(Media, "findAll").mockResolvedValue(mockMedia);
    mediaService.getUrl.mockReturnValue(
      "https://s3-eu-west-1.amazonaws.com/wri-terramatch-prod/96203/FarmLife_Kenya.jpg"
    );

    const result = await processor.getLightDto(mockStory);

    expect(result.id).toBe("6c6ee6d2-22e4-49d5-900d-53218867bf48");
    expect(result.dto).toBeInstanceOf(DashboardImpactStoryLightDto);
    expect(result.dto.organization).toEqual({
      name: "Farmlife Health Services",
      countries: [{ label: "KEN", icon: "/flags/ken.svg" }],
      facebook_url: "https://www.facebook.com/people/FarmLife-Health-Services-Ltd/100064171684456/?mibextid=ZbWKwL",
      instagram_url: null,
      linkedin_url: "https://www.linkedin.com/company/69225296/admin/feed/posts/",
      twitter_url: null
    });
    expect(result.dto.thumbnail).toBe(
      "https://s3-eu-west-1.amazonaws.com/wri-terramatch-prod/96203/FarmLife_Kenya.jpg"
    );
    expect(result.dto.category).toEqual(["livelihoods-strengthening", "business-dev-fund", "gender-equity"]);
  });

  it("should create light DTO with null organization", async () => {
    const mockStory = {
      id: 1,
      uuid: "6c6ee6d2-22e4-49d5-900d-53218867bf48",
      title: "Restoring Land, Empowering Farmers",
      date: "2025-02-21",
      category: "livelihoods-strengthening",
      status: "published",
      organisation: null
    } as unknown as ImpactStory;

    jest.spyOn(Media, "findAll").mockResolvedValue([]);

    const result = await processor.getLightDto(mockStory);

    expect(result.id).toBe("6c6ee6d2-22e4-49d5-900d-53218867bf48");
    expect(result.dto.organization).toBeNull();
    expect(result.dto.thumbnail).toBe("");
    expect(result.dto.category).toEqual(["livelihoods-strengthening"]);
  });

  it("should create full DTO from light DTO", async () => {
    const mockStory = {
      uuid: "test-uuid",
      title: "Test Story"
    } as ImpactStory;

    jest.spyOn(processor, "getLightDto").mockResolvedValue({
      id: "test-uuid",
      dto: new DashboardImpactStoryLightDto(mockStory)
    });

    const result = await processor.getFullDto(mockStory);

    expect(result.id).toBe("test-uuid");
    expect(result.dto).toBeInstanceOf(DashboardImpactStoryLightDto);
  });
});

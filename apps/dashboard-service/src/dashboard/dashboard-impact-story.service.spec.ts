import { Test, TestingModule } from "@nestjs/testing";
import { createMock, DeepMocked } from "@golevelup/ts-jest";
import { DashboardImpactStoryService } from "./dashboard-impact-story.service";
import { MediaService } from "@terramatch-microservices/common/media/media.service";
import { ImpactStory } from "@terramatch-microservices/database/entities";
import { Op } from "sequelize";

describe("DashboardImpactStoryService", () => {
  let service: DashboardImpactStoryService;
  let mediaService: DeepMocked<MediaService>;

  beforeEach(async () => {
    mediaService = createMock<MediaService>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: DashboardImpactStoryService,
          useFactory: () => new DashboardImpactStoryService(mediaService)
        },
        {
          provide: MediaService,
          useValue: mediaService
        }
      ]
    }).compile();

    service = module.get<DashboardImpactStoryService>(DashboardImpactStoryService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  it("should get dashboard impact stories without filters", async () => {
    const mockStories = [
      { uuid: "uuid-1", title: "Story 1" } as ImpactStory,
      { uuid: "uuid-2", title: "Story 2" } as ImpactStory
    ];

    jest.spyOn(ImpactStory, "findAll").mockResolvedValue(mockStories);

    const result = await service.getDashboardImpactStories({});

    expect(ImpactStory.findAll).toHaveBeenCalledWith({
      where: {},
      include: [
        {
          association: "organisation",
          attributes: ["uuid", "name", "type", "countries", "facebookUrl", "instagramUrl", "linkedinUrl", "twitterUrl"],
          where: undefined
        }
      ],
      order: [["id", "ASC"]]
    });
    expect(result).toBe(mockStories);
  });

  it("should get dashboard impact stories with country filter", async () => {
    const mockStories = [{ uuid: "uuid-1", title: "Story 1" } as ImpactStory];
    const params = { country: "Kenya" };

    jest.spyOn(ImpactStory, "findAll").mockResolvedValue(mockStories);

    const result = await service.getDashboardImpactStories(params);

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

  it("should get dashboard impact stories with organisation type filter", async () => {
    const mockStories = [{ uuid: "uuid-1", title: "Story 1" } as ImpactStory];
    const params = { organisationType: ["NGO", "for-profit"] };

    jest.spyOn(ImpactStory, "findAll").mockResolvedValue(mockStories);

    const result = await service.getDashboardImpactStories(params);

    expect(ImpactStory.findAll).toHaveBeenCalledWith({
      where: {},
      include: [
        {
          association: "organisation",
          attributes: ["uuid", "name", "type", "countries", "facebookUrl", "instagramUrl", "linkedinUrl", "twitterUrl"],
          where: { type: { [Op.in]: ["NGO", "for-profit"] } }
        }
      ],
      order: [["id", "ASC"]]
    });
    expect(result).toBe(mockStories);
  });

  it("should get dashboard impact story by UUID", async () => {
    const mockStory = { uuid: "test-uuid", title: "Test Story" } as ImpactStory;

    jest.spyOn(ImpactStory, "findOne").mockResolvedValue(mockStory);

    const result = await service.getDashboardImpactStoryById("test-uuid");

    expect(ImpactStory.findOne).toHaveBeenCalledWith({
      where: { uuid: "test-uuid" },
      include: [
        {
          association: "organisation",
          attributes: ["uuid", "name", "type", "countries", "facebookUrl", "instagramUrl", "linkedinUrl", "twitterUrl"]
        }
      ]
    });
    expect(result).toBe(mockStory);
  });
});

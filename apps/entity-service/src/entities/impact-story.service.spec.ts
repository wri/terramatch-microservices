import { Test, TestingModule } from "@nestjs/testing";
import { ImpactStoryService } from "./impact-story.service";
import { ImpactStory, Media, Project, WorldCountryGeneralized } from "@terramatch-microservices/database/entities";
import { ImpactStoryQueryDto } from "./dto/impact-story-query.dto";
import { NotFoundException, BadRequestException } from "@nestjs/common";
import { OrganisationFactory, ProjectFactory } from "@terramatch-microservices/database/factories";
import { MediaDto } from "./dto/media.dto";
import { Model } from "sequelize";
import { ImpactStoryLightDto } from "./dto/impact-story.dto";
import { Op } from "sequelize";

describe("ImpactStoryService", () => {
  let service: ImpactStoryService;

  const mockImpactStory = {
    uuid: "test-uuid",
    title: "Test Story",
    category: JSON.stringify({ type: "test" }),
    organisation: {
      uuid: "org-uuid",
      name: "Test Org",
      countries: ["US", "UK"]
    }
  };

  const mockMedia = [{ id: 1, modelUuid: "test-uuid", modelType: "impact_story", url: "test.jpg" }];

  const mockCountries = [
    { iso: "US", country: "United States" },
    { iso: "UK", country: "United Kingdom" }
  ];

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ImpactStoryService]
    }).compile();

    service = module.get<ImpactStoryService>(ImpactStoryService);

    // Mock ImpactStory.findOne
    jest.spyOn(ImpactStory, "findOne").mockImplementation(async (options: any) => {
      if (options.where.uuid === "test-uuid") {
        return mockImpactStory as any;
      }
      return null;
    });

    // Mock ImpactStory.findAll
    jest.spyOn(ImpactStory, "findAll").mockImplementation(async () => [mockImpactStory] as any);

    // Mock Media.findAll
    jest.spyOn(Media, "findAll").mockImplementation(async () => mockMedia as any);

    // Mock WorldCountryGeneralized.findAll
    jest.spyOn(WorldCountryGeneralized, "findAll").mockImplementation(async () => mockCountries as any);

    // Mock Project.findOne
    jest.spyOn(Project, "findOne").mockImplementation(async () => null);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("getImpactStory", () => {
    it("should return an impact story by uuid", async () => {
      const result = await service.getImpactStory("test-uuid");
      expect(result).toEqual(mockImpactStory);
      expect(ImpactStory.findOne).toHaveBeenCalledWith({
        where: { uuid: "test-uuid" },
        include: expect.any(Object)
      });
    });

    it("should throw NotFoundException when story not found", async () => {
      await expect(service.getImpactStory("non-existent")).rejects.toThrow(NotFoundException);
    });
  });

  describe("getMediaForStories", () => {
    it("should return media grouped by story uuid", async () => {
      const stories = [mockImpactStory] as any[];
      const result = await service.getMediaForStories(stories);
      expect(result).toEqual({
        "test-uuid": mockMedia
      });
      expect(Media.findAll).toHaveBeenCalledWith({
        where: {
          modelType: ImpactStory.LARAVEL_TYPE,
          modelUuid: ["test-uuid"]
        }
      });
    });
  });

  describe("getCountriesForOrganizations", () => {
    it("should return countries map for organization countries", async () => {
      const orgCountries = [["US", "UK"]];
      const result = await service.getCountriesForOrganizations(orgCountries);
      expect(result).toBeInstanceOf(Map);
      expect(result.get("US")).toEqual({
        label: "United States",
        icon: "/flags/us.svg"
      });
    });

    it("should return empty map for empty countries array", async () => {
      const result = await service.getCountriesForOrganizations([]);
      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBe(0);
    });
  });

  describe("getImpactStories", () => {
    it("should return paginated impact stories", async () => {
      const query = { page: { number: 1 } };
      const result = await service.getImpactStories(query as any);
      expect(result).toEqual({
        data: [mockImpactStory],
        paginationTotal: expect.any(Number),
        pageNumber: 1
      });
    });

    it("should handle search query", async () => {
      const query = { search: "test", page: { number: 1 } };
      await service.getImpactStories(query as any);
      expect(ImpactStory.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            [Op.or]: expect.arrayContaining([
              { title: { [Op.like]: "%test%" } },
              { "$organisation.name$": { [Op.like]: "%test%" } }
            ])
          })
        })
      );
    });

    it("should throw BadRequestException for invalid filter key", async () => {
      const query = { invalidKey: "value", page: { number: 1 } };
      await expect(service.getImpactStories(query as any)).rejects.toThrow(BadRequestException);
    });

    it("should throw BadRequestException for invalid sort field", async () => {
      const query = { sort: { field: "invalidField" }, page: { number: 1 } };
      await expect(service.getImpactStories(query as any)).rejects.toThrow(BadRequestException);
    });
  });
});

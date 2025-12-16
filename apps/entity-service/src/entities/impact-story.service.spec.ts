import { Test, TestingModule } from "@nestjs/testing";
import { ImpactStoryService } from "./impact-story.service";
import { ImpactStory, Media, Project, WorldCountryGeneralized } from "@terramatch-microservices/database/entities";
import { ImpactStoryQueryDto } from "./dto/impact-story-query.dto";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { Op } from "sequelize";

describe("ImpactStoryService", () => {
  let service: ImpactStoryService;

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
      providers: [ImpactStoryService]
    }).compile();

    service = module.get<ImpactStoryService>(ImpactStoryService);

    // Mock ImpactStory.findOne
    jest.spyOn(ImpactStory, "findOne").mockResolvedValue(mockImpactStory);

    // Mock ImpactStory.findAll
    jest.spyOn(ImpactStory, "findAll").mockResolvedValue([mockImpactStory]);

    // Mock Media.findAll
    jest.spyOn(Media, "findAll").mockResolvedValue(mockMedia);

    // Mock WorldCountryGeneralized.findAll
    jest.spyOn(WorldCountryGeneralized, "findAll").mockResolvedValue([
      { iso: "US", country: "United States" },
      { iso: "UK", country: "United Kingdom" }
    ] as unknown as WorldCountryGeneralized[]);

    // Mock Project.findOne
    jest.spyOn(Project, "findOne").mockResolvedValue({
      id: 1,
      uuid: "project-uuid",
      organisationId: 1
    } as unknown as Project);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("getImpactStory", () => {
    it("should return an impact story by uuid", async () => {
      const result = await service.getImpactStory("test-uuid");
      expect(result).toBeDefined();
      expect(result.uuid).toBe("test-uuid");
      expect(ImpactStory.findOne).toHaveBeenCalledWith({
        where: { uuid: "test-uuid" },
        include: expect.any(Object)
      });
    });

    it("should throw NotFoundException when story not found", async () => {
      jest.spyOn(ImpactStory, "findOne").mockResolvedValue(null);
      await expect(service.getImpactStory("non-existent")).rejects.toThrow(NotFoundException);
    });
  });

  describe("getMediaForStories", () => {
    it("should return media grouped by story id", async () => {
      const result = await service.getMediaForStories([mockImpactStory]);
      expect(result).toBeDefined();
      expect(result[mockImpactStory.id]).toBeDefined();
      expect(Media.findAll).toHaveBeenCalledWith({
        where: {
          modelType: ImpactStory.LARAVEL_TYPE,
          modelId: {
            [Op.in]: [mockImpactStory.id]
          }
        }
      });
    });
  });

  describe("getCountriesForOrganizations", () => {
    it("should return country map for organization countries", async () => {
      const result = await service.getCountriesForOrganizations([["US", "UK"]]);
      expect(result).toBeDefined();
      expect(result.get("US")).toBeDefined();
      expect(result.get("UK")).toBeDefined();
      expect(WorldCountryGeneralized.findAll).toHaveBeenCalledWith({
        where: {
          iso: {
            [Op.in]: ["US", "UK"]
          }
        }
      });
    });

    it("should return empty map for empty country list", async () => {
      const result = await service.getCountriesForOrganizations([]);
      expect(result).toBeDefined();
      expect(result.size).toBe(0);
      expect(WorldCountryGeneralized.findAll).not.toHaveBeenCalled();
    });
  });

  describe("getImpactStories", () => {
    it("should return paginated impact stories", async () => {
      const query: ImpactStoryQueryDto = {
        page: { number: 1 },
        search: "test",
        country: "US",
        organisationType: ["non-profit-organization"],
        projectUuid: "project-uuid"
      };

      const result = await service.getImpactStories(query);
      expect(result).toBeDefined();
      expect(result.data).toBeDefined();
      expect(result.paginationTotal).toBeDefined();
      expect(result.pageNumber).toBe(1);
    });

    it("should throw BadRequestException for invalid filter key", async () => {
      const query = {
        page: { number: 1 },
        invalidKey: "value"
      } as ImpactStoryQueryDto;

      await expect(service.getImpactStories(query)).rejects.toThrow(BadRequestException);
    });

    it("should handle projectUuid filter", async () => {
      const query: ImpactStoryQueryDto = {
        page: { number: 1 },
        projectUuid: "project-uuid"
      };

      await service.getImpactStories(query);
      expect(Project.findOne).toHaveBeenCalledWith({
        where: { uuid: "project-uuid" },
        attributes: ["organisationId"]
      });
    });

    it("should handle country filter", async () => {
      const query: ImpactStoryQueryDto = {
        page: { number: 1 },
        country: "US"
      };

      await service.getImpactStories(query);
      expect(ImpactStory.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            "$organisation.countries$": expect.any(Object)
          })
        })
      );
    });

    it("should handle organisationType filter", async () => {
      const query: ImpactStoryQueryDto = {
        page: { number: 1 },
        organisationType: ["non-profit-organization"]
      };

      await service.getImpactStories(query);
      expect(ImpactStory.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            "$organisation.type$": expect.any(Object)
          })
        })
      );
    });

    it("should handle category filter", async () => {
      const query: ImpactStoryQueryDto = {
        page: { number: 1 },
        category: ["test"]
      };

      await service.getImpactStories(query);
      expect(ImpactStory.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            [Op.or]: expect.any(Array)
          })
        })
      );
    });

    it("should handle sort by id", async () => {
      const query: ImpactStoryQueryDto = {
        page: { number: 1 },
        sort: { field: "id", direction: "DESC" }
      };

      await service.getImpactStories(query);
      expect(ImpactStory.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          order: [["id", "DESC"]]
        })
      );
    });

    it("should handle sort by title", async () => {
      const query: ImpactStoryQueryDto = {
        page: { number: 1 },
        sort: { field: "title", direction: "ASC" }
      };

      await service.getImpactStories(query);
      expect(ImpactStory.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          order: [["title", "ASC"]]
        })
      );
    });

    it("should handle sort by organization.name", async () => {
      const query: ImpactStoryQueryDto = {
        page: { number: 1 },
        sort: { field: "organization.name", direction: "DESC" }
      };

      await service.getImpactStories(query);
      expect(ImpactStory.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          order: [["organisation", "name", "DESC"]]
        })
      );
    });

    it("should handle sort by organization.countries", async () => {
      const query: ImpactStoryQueryDto = {
        page: { number: 1 },
        sort: { field: "organization.countries", direction: "ASC" }
      };

      await service.getImpactStories(query);
      expect(ImpactStory.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          order: [["organisation", "countries", "ASC"]]
        })
      );
    });

    it("should throw BadRequestException for invalid sort field", async () => {
      const query: ImpactStoryQueryDto = {
        page: { number: 1 },
        sort: { field: "invalid", direction: "ASC" }
      };

      await expect(service.getImpactStories(query)).rejects.toThrow(BadRequestException);
    });
  });
});

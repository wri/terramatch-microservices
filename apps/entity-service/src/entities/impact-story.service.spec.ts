import { Test, TestingModule } from "@nestjs/testing";
import { ImpactStoryService } from "./impact-story.service";
import {
  ImpactStory,
  Media,
  Organisation,
  Project,
  WorldCountryGeneralized
} from "@terramatch-microservices/database/entities";
import { ImpactStoryQueryDto } from "./dto/impact-story-query.dto";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { Op } from "sequelize";
import { CreateImpactStoryAttributes } from "./dto/create-impact-story.dto";
import { UpdateImpactStoryAttributes } from "./dto/update-impact-story.dto";

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

  describe("buildOrganizationData", () => {
    it("should build organization data with full details", async () => {
      const result = await service.buildOrganizationData(mockImpactStory, true);
      expect(result).toBeDefined();
      expect(result.uuid).toBe("org-uuid");
      expect(result.name).toBe("Test Org");
      expect(result.countries).toBeDefined();
      expect(result.webUrl).toBeDefined();
    });

    it("should build organization data without full details", async () => {
      const result = await service.buildOrganizationData(mockImpactStory, false);
      expect(result).toBeDefined();
      expect(result.uuid).toBe("org-uuid");
      expect(result.webUrl).toBeUndefined();
    });

    it("should handle null organisation", async () => {
      const storyWithoutOrg = { ...mockImpactStory, organisation: null } as unknown as ImpactStory;
      const result = await service.buildOrganizationData(storyWithoutOrg, false);
      expect(result).toBeDefined();
      expect(result.uuid).toBeNull();
      expect(result.name).toBeNull();
      expect(result.countries).toEqual([]);
    });
  });

  describe("getImpactStoryWithMedia", () => {
    it("should return impact story with media and organization", async () => {
      jest.spyOn(Media, "for").mockReturnValue({
        findAll: jest.fn().mockResolvedValue(mockMedia)
      } as unknown as ReturnType<typeof Media.for>);

      const result = await service.getImpactStoryWithMedia("test-uuid", true);
      expect(result).toBeDefined();
      expect(result.impactStory).toBeDefined();
      expect(result.mediaCollection).toBeDefined();
      expect(result.organization).toBeDefined();
    });

    it("should throw NotFoundException when story not found", async () => {
      jest.spyOn(ImpactStory, "findOne").mockResolvedValue(null);
      await expect(service.getImpactStoryWithMedia("non-existent", false)).rejects.toThrow(NotFoundException);
    });
  });

  describe("createImpactStory", () => {
    const createAttributes: CreateImpactStoryAttributes = {
      title: "New Story",
      status: "draft",
      organizationUuid: "org-uuid-123",
      date: "2024-01-01",
      category: ["test"],
      content: "Test content"
    };

    beforeEach(() => {
      jest.spyOn(Organisation, "findOne").mockResolvedValue({
        id: 1,
        uuid: "org-uuid-123"
      } as unknown as Organisation);

      jest.spyOn(ImpactStory, "create").mockResolvedValue({
        uuid: "new-uuid",
        id: 2
      } as unknown as ImpactStory);

      jest.spyOn(ImpactStory, "findOne").mockResolvedValue(mockImpactStory);
    });

    it("should create impact story successfully", async () => {
      const result = await service.createImpactStory(createAttributes);
      expect(result).toBeDefined();
      expect(Organisation.findOne).toHaveBeenCalledWith({
        where: { uuid: "org-uuid-123" },
        attributes: ["id"]
      });
      expect(ImpactStory.create).toHaveBeenCalled();
    });

    it("should throw BadRequestException when organization not found", async () => {
      jest.spyOn(Organisation, "findOne").mockResolvedValue(null);
      await expect(service.createImpactStory(createAttributes)).rejects.toThrow(BadRequestException);
    });

    it("should handle optional fields", async () => {
      const minimalAttributes: CreateImpactStoryAttributes = {
        title: "Minimal Story",
        status: "draft",
        organizationUuid: "org-uuid-123"
      };

      const result = await service.createImpactStory(minimalAttributes);
      expect(result).toBeDefined();
      expect(ImpactStory.create).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Minimal Story",
          status: "draft",
          category: [],
          thumbnail: ""
        })
      );
    });

    it("should throw NotFoundException when reload fails", async () => {
      jest.spyOn(ImpactStory, "findOne").mockResolvedValue(null);
      await expect(service.createImpactStory(createAttributes)).rejects.toThrow(NotFoundException);
    });
  });

  describe("updateImpactStory", () => {
    const updateAttributes: UpdateImpactStoryAttributes = {
      status: "published",
      title: "Updated Title"
    };

    const mockImpactStoryWithUpdate = {
      ...mockImpactStory,
      status: "draft",
      title: "Original Title",
      save: jest.fn().mockResolvedValue(mockImpactStory)
    } as unknown as ImpactStory;

    beforeEach(() => {
      jest.spyOn(ImpactStory, "findOne").mockResolvedValue(mockImpactStoryWithUpdate);
    });

    it("should update impact story successfully", async () => {
      const result = await service.updateImpactStory("test-uuid", updateAttributes);
      expect(result).toBeDefined();
      expect(mockImpactStoryWithUpdate.save).toHaveBeenCalled();
    });

    it("should throw NotFoundException when story not found", async () => {
      jest.spyOn(ImpactStory, "findOne").mockResolvedValue(null);
      await expect(service.updateImpactStory("non-existent", updateAttributes)).rejects.toThrow(NotFoundException);
    });

    it("should handle organization UUID update", async () => {
      const updateWithOrg: UpdateImpactStoryAttributes = {
        status: "published",
        organizationUuid: "new-org-uuid"
      };

      jest.spyOn(Organisation, "findOne").mockResolvedValue({
        id: 2,
        uuid: "new-org-uuid"
      } as unknown as Organisation);

      await service.updateImpactStory("test-uuid", updateWithOrg);
      expect(Organisation.findOne).toHaveBeenCalledWith({
        where: { uuid: "new-org-uuid" },
        attributes: ["id"]
      });
      expect(mockImpactStoryWithUpdate.save).toHaveBeenCalled();
      expect(mockImpactStoryWithUpdate.organizationId).toBe(2);
    });

    it("should throw BadRequestException when organization not found", async () => {
      const updateWithOrg: UpdateImpactStoryAttributes = {
        status: "published",
        organizationUuid: "non-existent-org"
      };

      jest.spyOn(Organisation, "findOne").mockResolvedValue(null);
      await expect(service.updateImpactStory("test-uuid", updateWithOrg)).rejects.toThrow(BadRequestException);
    });

    it("should handle undefined optional fields", async () => {
      const updateWithUndefined: UpdateImpactStoryAttributes = {
        status: "published",
        date: undefined,
        content: undefined
      };

      await service.updateImpactStory("test-uuid", updateWithUndefined);
      expect(mockImpactStoryWithUpdate.save).toHaveBeenCalled();
    });

    it("should throw NotFoundException when reload fails", async () => {
      jest.spyOn(ImpactStory, "findOne").mockImplementationOnce(() => Promise.resolve(mockImpactStoryWithUpdate));
      jest.spyOn(ImpactStory, "findOne").mockImplementationOnce(() => Promise.resolve(null));
      await expect(service.updateImpactStory("test-uuid", updateAttributes)).rejects.toThrow(NotFoundException);
    });
  });

  describe("deleteImpactStory", () => {
    const mockImpactStoryWithDestroy = {
      ...mockImpactStory,
      destroy: jest.fn().mockResolvedValue(undefined)
    } as unknown as ImpactStory;

    beforeEach(() => {
      jest.spyOn(ImpactStory, "findOne").mockResolvedValue(mockImpactStoryWithDestroy);
    });

    it("should delete impact story successfully", async () => {
      await service.deleteImpactStory("test-uuid");
      expect(ImpactStory.findOne).toHaveBeenCalledWith({ where: { uuid: "test-uuid" } });
      expect(mockImpactStoryWithDestroy.destroy).toHaveBeenCalled();
    });

    it("should throw NotFoundException when story not found", async () => {
      jest.spyOn(ImpactStory, "findOne").mockResolvedValue(null);
      await expect(service.deleteImpactStory("non-existent")).rejects.toThrow(NotFoundException);
      expect(mockImpactStoryWithDestroy.destroy).not.toHaveBeenCalled();
    });
  });

  describe("bulkDeleteImpactStories", () => {
    const mockStory1 = { id: 1, uuid: "uuid-1" } as ImpactStory;
    const mockStory2 = { id: 2, uuid: "uuid-2" } as ImpactStory;

    beforeEach(() => {
      jest.spyOn(ImpactStory, "findAll").mockResolvedValue([mockStory1, mockStory2]);
      jest.spyOn(ImpactStory, "destroy").mockResolvedValue(2);
    });

    it("should bulk delete impact stories successfully", async () => {
      const result = await service.bulkDeleteImpactStories(["uuid-1", "uuid-2"]);
      expect(result).toEqual(["uuid-1", "uuid-2"]);
      expect(ImpactStory.findAll).toHaveBeenCalledWith({
        where: { uuid: { [Op.in]: ["uuid-1", "uuid-2"] } },
        attributes: ["id", "uuid"]
      });
      expect(ImpactStory.destroy).toHaveBeenCalledWith({
        where: { id: { [Op.in]: [1, 2] } }
      });
    });

    it("should throw BadRequestException for empty UUID list", async () => {
      await expect(service.bulkDeleteImpactStories([])).rejects.toThrow(BadRequestException);
      expect(ImpactStory.findAll).not.toHaveBeenCalled();
    });

    it("should throw NotFoundException when no stories found", async () => {
      jest.spyOn(ImpactStory, "findAll").mockResolvedValue([]);
      await expect(service.bulkDeleteImpactStories(["non-existent"])).rejects.toThrow(NotFoundException);
      expect(ImpactStory.destroy).not.toHaveBeenCalled();
    });

    it("should throw NotFoundException when some UUIDs not found", async () => {
      jest.spyOn(ImpactStory, "findAll").mockResolvedValue([mockStory1]);
      await expect(service.bulkDeleteImpactStories(["uuid-1", "uuid-2"])).rejects.toThrow(NotFoundException);
      expect(ImpactStory.destroy).not.toHaveBeenCalled();
    });

    it("should filter out null UUIDs", async () => {
      const mockStoryWithNull = { id: 3, uuid: null } as unknown as ImpactStory;
      jest.spyOn(ImpactStory, "findAll").mockResolvedValue([mockStory1, mockStoryWithNull]);
      const result = await service.bulkDeleteImpactStories(["uuid-1"]);
      expect(result).toEqual(["uuid-1"]);
    });
  });
});

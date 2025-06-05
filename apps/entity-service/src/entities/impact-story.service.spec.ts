import { Test, TestingModule } from "@nestjs/testing";
import { ImpactStoryService } from "./impact-story.service";
import { ImpactStory, Project } from "@terramatch-microservices/database/entities";
import { ImpactStoryQueryDto } from "./dto/impact-story-query.dto";
import { NotFoundException, BadRequestException } from "@nestjs/common";
import { OrganisationFactory, ProjectFactory } from "@terramatch-microservices/database/factories";
import { MediaDto } from "./dto/media.dto";
import { Model } from "sequelize";
import { ImpactStoryLightDto } from "./dto/impact-story.dto";

describe("ImpactStoryService", () => {
  let service: ImpactStoryService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ImpactStoryService]
    }).compile();

    service = module.get<ImpactStoryService>(ImpactStoryService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("getImpactStory", () => {
    it("should return an impact story when found", async () => {
      const organisation = await OrganisationFactory.create();
      const mockData = {
        id: 1,
        thumbnail: [{} as MediaDto],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lightResources: "",
        uuid: "test-uuid",
        title: "Test Story",
        organizationId: organisation.id,
        status: "active",
        date: new Date().toISOString(),
        category: ["test"],
        content: ["Test content"],
        lightResource: true,
        organization: {
          id: organisation.id,
          uuid: organisation.uuid,
          name: "Test Org",
          type: "test",
          countries: ["US"],
          webUrl: "http://test.com",
          facebookUrl: "http://facebook.com/test",
          instagramUrl: "http://instagram.com/test",
          linkedinUrl: "http://linkedin.com/test",
          twitterUrl: "http://twitter.com/test"
        }
      };

      const mockImpactStory = {
        ...mockData,
        get: () => mockData,
        toJSON: () => mockData
      } as unknown as Model<ImpactStory>;

      jest.spyOn(ImpactStory, "findOne").mockResolvedValue(mockImpactStory);

      const result = await service.getImpactStory("test-uuid");

      expect(result).toBeDefined();
      expect(result.uuid).toBe(mockData.uuid);
      expect(result.organisation).toBeDefined();
      expect(result.organisation.id).toBe(organisation.id);
    });

    it("should throw NotFoundException when impact story is not found", async () => {
      jest.spyOn(ImpactStory, "findOne").mockResolvedValue(null);

      await expect(service.getImpactStory("non-existent-uuid")).rejects.toThrow(NotFoundException);
    });
  });

  describe("getImpactStories", () => {
    it("should return paginated impact stories", async () => {
      const organisation = await OrganisationFactory.create();
      const mockData = (index: number) => ({
        uuid: `test-uuid-${index}`,
        title: "Test Story",
        organizationId: organisation.id,
        status: "active",
        date: new Date().toISOString(),
        category: ["test"],
        content: ["Test content"],
        createdAt: new Date(),
        updatedAt: new Date(),
        lightResources: "",
        lightResource: true,
        thumbnail: [],
        organization: {
          id: organisation.id,
          uuid: organisation.uuid,
          name: "Test Org",
          type: "test",
          countries: ["US"],
          webUrl: "https://example.com",
          facebookUrl: "",
          instagramUrl: "",
          linkedinUrl: "",
          twitterUrl: ""
        }
      });

      const mockImpactStories: Partial<Model<ImpactStory>>[] = Array(3)
        .fill(null)
        .map((_, index) => ({
          get: () => mockData(index),
          toJSON: () => mockData(index)
        })) as unknown as Partial<Model<ImpactStory>>[];

      jest.spyOn(ImpactStory, "findAll").mockResolvedValue(mockImpactStories as Model<ImpactStory>[]);
      jest.spyOn(ImpactStory, "count").mockResolvedValue(3);

      const query: ImpactStoryQueryDto = {
        page: { number: 1, size: 10 }
      };

      const result = await service.getImpactStories(query);

      expect(result.data).toHaveLength(3);
      expect(result.paginationTotal).toBe(3);
      expect(result.pageNumber).toBe(1);
    });

    it("should filter impact stories by search term", async () => {
      const organisation = await OrganisationFactory.create({ name: "Test Org" });
      const mockImpactStory: ImpactStoryLightDto = {
        id: 1,
        uuid: "test-uuid",
        title: "Test Impact Story",
        status: "active",
        date: new Date().toISOString(),
        category: ["test"],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lightResource: true,
        thumbnail: [],
        organization: {
          id: organisation.id,
          uuid: organisation.uuid,
          name: "Test Org",
          type: "test",
          countries: ["US"],
          webUrl: "",
          facebookUrl: "",
          instagramUrl: "",
          linkedinUrl: "",
          twitterUrl: ""
        }
      };

      class MockImpactStory extends ImpactStory {
        constructor(data: Partial<ImpactStoryLightDto>) {
          super();
          Object.assign(this, data);
        }
      }

      const mockImpactStoryInstance = new MockImpactStory(mockImpactStory);

      jest.spyOn(ImpactStory, "findAll").mockResolvedValue([mockImpactStoryInstance]);
      jest.spyOn(ImpactStory, "count").mockResolvedValue(1);

      const query: ImpactStoryQueryDto = {
        page: { number: 1, size: 10 },
        search: "Test"
      };

      const result = await service.getImpactStories(query);

      expect(result.data).toHaveLength(1);
      expect(result.data[0].uuid).toBe(mockImpactStory.uuid);
    });

    it("should filter impact stories by organization", async () => {
      const organisation = await OrganisationFactory.create();

      const mockImpactStory = {
        id: 1,
        uuid: "test-uuid",
        title: "Test Story",
        organizationId: organisation.id,
        status: "active",
        date: new Date().toISOString(),
        category: ["test"],
        content: ["Test content"],
        createdAt: new Date(),
        updatedAt: new Date(),
        lightResources: "",
        lightResource: true,
        thumbnail: [],
        organization: {
          id: organisation.id,
          uuid: organisation.uuid,
          name: "Test Org",
          type: "test",
          countries: ["US"],
          webUrl: "https://example.com",
          facebookUrl: "",
          instagramUrl: "",
          linkedinUrl: "",
          twitterUrl: ""
        }
      } as any;

      jest.spyOn(ImpactStory, "findAll").mockResolvedValue([mockImpactStory]);
      jest.spyOn(ImpactStory, "count").mockResolvedValue(1);

      const query: ImpactStoryQueryDto = {
        page: { number: 1, size: 10 },
        filter: { organizationId: organisation.id.toString() }
      };

      const result = await service.getImpactStories(query);

      expect(result.data).toHaveLength(1);
      expect(result.data[0].uuid).toBe(mockImpactStory.uuid);
    });

    it("should filter impact stories by project", async () => {
      const organisation = await OrganisationFactory.create();
      const project = await ProjectFactory.create({
        organisationId: organisation.id
      });
      const mockImpactStory = {
        uuid: "test-uuid",
        title: "Test Story",
        organizationId: organisation.id,
        status: "active",
        date: new Date().toISOString(),
        category: "test",
        content: "Test content",
        organisation: {
          id: organisation.id,
          uuid: organisation.uuid,
          name: "Test Org",
          type: "test",
          countries: ["US"]
        }
      };

      jest.spyOn(Project, "findOne").mockResolvedValue({ organisationId: organisation.id } as any);
      jest.spyOn(ImpactStory, "findAll").mockResolvedValue([mockImpactStory] as any);
      jest.spyOn(ImpactStory, "count").mockResolvedValue(1);

      const query: ImpactStoryQueryDto = {
        page: { number: 1, size: 10 },
        filter: { projectId: project.id.toString() }
      };

      const result = await service.getImpactStories(query);

      expect(result.data).toHaveLength(1);
      expect(result.data[0].uuid).toBe(mockImpactStory.uuid);
    });

    it("should throw BadRequestException for invalid filter key", async () => {
      const query: ImpactStoryQueryDto = {
        page: { number: 1, size: 10 },
        filter: { invalidKey: "value" }
      };

      await expect(service.getImpactStories(query)).rejects.toThrow(BadRequestException);
    });

    it("should throw BadRequestException for invalid sort field", async () => {
      const query: ImpactStoryQueryDto = {
        page: { number: 1, size: 10 },
        sort: { field: "invalidField", direction: "ASC" }
      };

      await expect(service.getImpactStories(query)).rejects.toThrow(BadRequestException);
    });
  });
});

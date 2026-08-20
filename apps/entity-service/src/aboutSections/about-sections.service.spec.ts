import { Test, TestingModule } from "@nestjs/testing";
import { AboutSectionsService } from "./about-sections.service";
import { AboutSection, Link } from "@terramatch-microservices/database/entities";
import { AboutSectionFactory, LinkFactory } from "@terramatch-microservices/database/factories";
import { buildJsonApi, Resource } from "@terramatch-microservices/common/util";
import { AboutSectionDto, LinkDto, StoreAboutSectionAttributes } from "./dto/about-section.dto";
import { serialize } from "@terramatch-microservices/common/util/testing";
import { ABOUT_SECTION_TYPES } from "@terramatch-microservices/database/entities/about-section.entity";
import { faker } from "@faker-js/faker";

describe("AboutSectionsService", () => {
  let module: TestingModule;
  let service: AboutSectionsService;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      providers: [AboutSectionsService]
    }).compile();

    service = module.get(AboutSectionsService);

    await AboutSection.truncate();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("findOne", () => {
    it("should return the specific section if there is one", async () => {
      await AboutSectionFactory.create({ type: "project" });
      const specificSection = await AboutSectionFactory.create({ type: "project", frameworks: ["ppc", "terrafund"] });
      const result = await service.findOne("project", "ppc");
      expect(result?.id).toEqual(specificSection.id);
    });

    it("should return the default if there is no specific section", async () => {
      const defaultSection = await AboutSectionFactory.create({ type: "project" });
      await AboutSectionFactory.create({ type: "project", frameworks: ["ppc", "terrafund"] });
      const result = await service.findOne("project", "hbf");
      expect(result?.id).toEqual(defaultSection.id);
    });

    it("should return null if there is no default", async () => {
      await AboutSectionFactory.create({ type: "project" });
      await AboutSectionFactory.create({ type: "project", frameworks: ["ppc", "terrafund"] });
      expect(await service.findOne("site", "ppc")).toBeNull();
    });
  });

  describe("addIndex", () => {
    it("should throw if framework is set and not type", async () => {
      await expect(service.addIndex(buildJsonApi(AboutSectionDto), { framework: "ppc" })).rejects.toThrow(
        "Type is required when framework is specified"
      );
    });

    it("should throw if page is greater than one when using framework and type", async () => {
      await expect(
        service.addIndex(buildJsonApi(AboutSectionDto), { framework: "ppc", type: "project", page: { number: 2 } })
      ).rejects.toThrow("Only the first page is available when framework is specified");
    });

    it("should return 0 results when there is no default", async () => {
      await AboutSectionFactory.create({ type: "project" });
      await AboutSectionFactory.create({ type: "project", frameworks: ["ppc", "terrafund"] });
      const result = serialize(
        await service.addIndex(buildJsonApi(AboutSectionDto), { type: "site", framework: "hbf" })
      );
      expect(result.meta.indices?.[0]?.total).toEqual(0);
    });

    it("should return the correct section", async () => {
      const section = await AboutSectionFactory.create({ type: "project" });
      const result = serialize(
        await service.addIndex(buildJsonApi(AboutSectionDto), { type: "project", framework: "ppc" })
      );
      expect(result.meta.indices?.[0]?.total).toEqual(1);
      expect((result.data as Resource[])[0]?.id).toEqual(section.uuid);
    });

    it("should return all for a given type", async () => {
      const ids = (await AboutSectionFactory.createMany(2, { type: "project" })).map(({ uuid }) => uuid as string);
      await AboutSectionFactory.create({ type: "site" });
      const result = serialize(await service.addIndex(buildJsonApi(AboutSectionDto), { type: "project" }));
      expect(result.meta.indices?.[0]?.total).toEqual(2);
      expect(ids).toContain((result.data as Resource[])[0]?.id);
      expect(ids).toContain((result.data as Resource[])[1]?.id);
    });
  });

  describe("addDto", () => {
    it("should add the DTO with entity properties", async () => {
      const section = await AboutSectionFactory.create();
      const links = [
        await LinkFactory.section(section).create({ order: 1 }),
        await LinkFactory.section(section).create({ order: 2 })
      ];

      const result = serialize(await service.addDto(buildJsonApi(AboutSectionDto), section));
      const dto = result.data as Resource;
      const linkDtos = dto.attributes.links as unknown as LinkDto[];
      expect(dto.attributes.header).toEqual(section.header);
      expect(dto.attributes.description).toEqual(section.description);
      expect(dto.attributes.contactSupportSubject).toEqual(section.contactSupportSubject);
      expect(dto.attributes.contactSupportMessage).toEqual(section.contactSupportMessage);
      expect(linkDtos[0].title).toEqual(links[0].title);
      expect(linkDtos[1].title).toEqual(links[1].title);
    });
  });

  describe("store", () => {
    beforeEach(async () => {
      await AboutSection.truncate();
    });

    const castAttr = (attr: Partial<StoreAboutSectionAttributes>) => attr as StoreAboutSectionAttributes;

    it("throws if the call attempts to create a second default", async () => {
      await AboutSectionFactory.create({ type: "project" });
      await expect(service.store(castAttr({ type: "project", frameworks: [] }))).rejects.toThrow(
        'The default About Section for type "project" is already set'
      );
    });

    it("throws if the call attempts to cover a framework that is already covered", async () => {
      const section = await AboutSectionFactory.create({ type: "project", frameworks: ["hbf", "ppc"] });
      await AboutSectionFactory.create({ type: "project", frameworks: ["epa-ghana-pilot"] });
      await expect(service.store(castAttr({ type: "project", frameworks: ["hbf"] }))).rejects.toThrow(
        'The About Section for type "project" and framework "hbf" is already set'
      );
      await expect(service.store(castAttr({ type: "project", frameworks: ["terrafund", "ppc"] }))).rejects.toThrow(
        'The About Section for type "project" and framework "ppc" is already set'
      );
      await expect(
        service.store(castAttr({ type: "project", frameworks: ["hbf", "epa-ghana-pilot"] }), section)
      ).rejects.toThrow('The About Section for type "project" and framework "epa-ghana-pilot" is already set');
    });

    it("creates a new section", async () => {
      const attributes: StoreAboutSectionAttributes = {
        type: faker.helpers.arrayElement(ABOUT_SECTION_TYPES),
        frameworks: ["ppc"],
        header: faker.lorem.sentence(),
        title: faker.lorem.sentence(),
        description: faker.lorem.paragraph(),
        contactSupportMessage: faker.lorem.sentence(),
        contactSupportSubject: faker.lorem.sentence(),
        links: []
      };
      const section = await service.store(attributes);

      expect(section.type).toEqual(attributes.type);
      expect(section.frameworks).toEqual(attributes.frameworks);
      expect(section.header).toEqual(attributes.header);
      expect(section.title).toEqual(attributes.title);
      expect(section.description).toEqual(attributes.description);
      expect(section.contactSupportMessage).toEqual(attributes.contactSupportMessage);
      expect(section.contactSupportSubject).toEqual(attributes.contactSupportSubject);
    });

    it("updates an existing section", async () => {
      const section = await AboutSectionFactory.create({ frameworks: ["ppc", "terrafund"] });
      const links = [
        await LinkFactory.section(section).create({ order: 0 }),
        await LinkFactory.section(section).create({ order: 1 })
      ];

      const attributes: StoreAboutSectionAttributes = {
        type: section.type,
        frameworks: ["terrafund", "ppc"],
        header: faker.lorem.sentence(),
        title: faker.lorem.sentence(),
        description: faker.lorem.paragraph(),
        contactSupportMessage: faker.lorem.sentence(),
        contactSupportSubject: faker.lorem.sentence(),
        links: [
          { id: links[1].uuid, title: links[1].title, url: faker.internet.url() },
          { title: faker.lorem.sentence(), url: faker.internet.url() }
        ]
      };

      await service.store(attributes, section);

      expect(section.type).toEqual(attributes.type);
      expect(section.frameworks).toEqual(attributes.frameworks);
      expect(section.header).toEqual(attributes.header);
      expect(section.title).toEqual(attributes.title);
      expect(section.description).toEqual(attributes.description);
      expect(section.contactSupportMessage).toEqual(attributes.contactSupportMessage);
      expect(section.contactSupportSubject).toEqual(attributes.contactSupportSubject);
      expect(section.links?.length).toEqual(attributes.links.length);
      expect(section.links?.[0].id).toEqual(links[1].id);
      expect(section.links?.[0].title).toEqual(links[1].title);
      expect(section.links?.[0].url).toEqual(attributes.links[0].url);
      expect(section.links?.[0].order).toEqual(0);
      expect(section.links?.[1].title).toEqual(attributes.links[1].title);
      expect(section.links?.[1].url).toEqual(attributes.links[1].url);
      expect(section.links?.[1].order).toEqual(1);
      expect(await Link.for(section).count()).toEqual(2);
    });
  });
});

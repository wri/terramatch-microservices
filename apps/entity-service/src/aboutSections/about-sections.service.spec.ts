import { Test, TestingModule } from "@nestjs/testing";
import { AboutSectionsService } from "./about-sections.service";
import { createMock, DeepMocked } from "@golevelup/ts-jest";
import { AboutSection, DelayedJob } from "@terramatch-microservices/database/entities";
import { AboutSectionFactory, LinkFactory } from "@terramatch-microservices/database/factories";
import { buildJsonApi, Resource } from "@terramatch-microservices/common/util";
import { AboutSectionDto, LinkDto } from "./dto/about-section.dto";
import { serialize } from "@terramatch-microservices/common/util/testing";
import { getQueueToken } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { ENTITY_SERVICE_EXPORT_QUEUE, PUSH_TRANSLATIONS } from "../jobs/entity-service-delayed-jobs.processor";

describe("AboutSectionsService", () => {
  let module: TestingModule;
  let service: AboutSectionsService;

  const exportQueue = (): DeepMocked<Queue> => module.get(getQueueToken(ENTITY_SERVICE_EXPORT_QUEUE));

  beforeEach(async () => {
    module = await Test.createTestingModule({
      providers: [
        AboutSectionsService,
        { provide: getQueueToken(ENTITY_SERVICE_EXPORT_QUEUE), useValue: createMock<Queue>() }
      ]
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

  describe("getI18nLabels", () => {
    it("should return all appropriate i18n labels", async () => {
      const section = await AboutSectionFactory.create();
      const links = [
        await LinkFactory.section(section).create({ order: 2 }),
        await LinkFactory.section(section).create({ order: 1 })
      ];
      const result = await service.getI18nLabels(section);
      expect(result).toEqual([
        section.header,
        section.description,
        section.contactSupportMessage,
        section.contactSupportSubject,
        links[1].title,
        links[0].title
      ]);
    });
  });

  describe("pushTranslations", () => {
    it("should queue a delayed job to push translations", async () => {
      const section = await AboutSectionFactory.create();
      const i18nLabels = await service.getI18nLabels(section);
      const delayedJob = { id: 99, uuid: "job-uuid" } as DelayedJob;
      jest.spyOn(DelayedJob, "create").mockResolvedValue(delayedJob);

      await service.pushTranslations(section);

      expect(exportQueue().add).toHaveBeenCalledWith(PUSH_TRANSLATIONS, {
        delayedJobId: 99,
        uuid: section.uuid,
        i18nLabels
      });
    });
  });
});

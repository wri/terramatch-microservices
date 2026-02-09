import { Test, TestingModule } from "@nestjs/testing";
import { ReportingFrameworksService } from "./reporting-frameworks.service";
import { Framework, Project, FrameworkUser } from "@terramatch-microservices/database/entities";
import { NotFoundException } from "@nestjs/common";
import { FrameworkFactory, ProjectFactory } from "@terramatch-microservices/database/factories";
import { buildJsonApi } from "@terramatch-microservices/common/util";
import { ReportingFrameworkDto } from "./dto/reporting-framework.dto";

describe("ReportingFrameworksService", () => {
  let service: ReportingFrameworksService;
  const createdFrameworkIds: number[] = [];

  beforeEach(async () => {
    try {
      await Project.truncate({ cascade: true });
    } catch {
      await Project.destroy({ where: {}, force: true });
    }

    const module: TestingModule = await Test.createTestingModule({
      providers: [ReportingFrameworksService]
    }).compile();

    service = module.get<ReportingFrameworksService>(ReportingFrameworksService);
    createdFrameworkIds.length = 0;
  });

  afterEach(async () => {
    if (createdFrameworkIds.length > 0) {
      await FrameworkUser.destroy({ where: { frameworkId: createdFrameworkIds }, force: true });
      await Framework.destroy({ where: { id: createdFrameworkIds }, force: true });
    }
    jest.restoreAllMocks();
  });

  describe("findBySlug", () => {
    it("should return a framework by slug", async () => {
      await Framework.destroy({ where: { slug: "terrafund" }, force: true });
      const framework = await FrameworkFactory.create({ slug: "terrafund" });
      createdFrameworkIds.push(framework.id);

      const result = await service.findBySlug("terrafund");

      expect(result).toBeInstanceOf(Framework);
      expect(result.slug).toBe("terrafund");
      expect(result.id).toBe(framework.id);
    });

    it("should throw NotFoundException for invalid slug", async () => {
      await expect(service.findBySlug("non-existent")).rejects.toThrow(NotFoundException);
      await expect(service.findBySlug("non-existent")).rejects.toThrow("Reporting framework not found");
    });

    it("should throw NotFoundException for empty string slug", async () => {
      await expect(service.findBySlug("")).rejects.toThrow(NotFoundException);
      await expect(service.findBySlug("")).rejects.toThrow("Reporting framework not found");
    });
  });

  describe("findAll", () => {
    it("should return all frameworks", async () => {
      const frameworks = await FrameworkFactory.createMany(5);
      createdFrameworkIds.push(...frameworks.map(f => f.id));

      const result = await service.findAll();
      const createdFrameworks = result.filter(f => createdFrameworkIds.includes(f.id));

      expect(createdFrameworks).toHaveLength(5);
      expect(createdFrameworks.every(f => f instanceof Framework)).toBe(true);
    });

    it("should return empty array when no frameworks exist", async () => {
      const result = await service.findAll();

      expect(Array.isArray(result)).toBe(true);
      expect(result).toBeDefined();
    });
  });

  describe("calculateProjectsCount", () => {
    it("should return count of projects with matching frameworkKey", async () => {
      const framework1 = await FrameworkFactory.create({ slug: "terrafund" });
      createdFrameworkIds.push(framework1.id);
      await ProjectFactory.createMany(7, { frameworkKey: "terrafund" });
      await ProjectFactory.createMany(3, { frameworkKey: "ppc" });

      const result = await service.calculateProjectsCount("terrafund");

      expect(result).toBe(7);
    });

    it("should return 0 for framework with no projects", async () => {
      const framework = await FrameworkFactory.create({ slug: "ppc" });
      createdFrameworkIds.push(framework.id);

      const result = await service.calculateProjectsCount("ppc");

      expect(result).toBe(0);
    });

    it("should return 0 for null slug", async () => {
      const result = await service.calculateProjectsCount(null);

      expect(result).toBe(0);
    });

    it("should return 0 for empty string slug", async () => {
      const result = await service.calculateProjectsCount("");

      expect(result).toBe(0);
    });
  });

  describe("addDto", () => {
    it("should add framework dto to document with project count", async () => {
      const framework = await FrameworkFactory.create({ slug: "hbf" });
      createdFrameworkIds.push(framework.id);
      await ProjectFactory.createMany(5, { frameworkKey: "hbf" });
      const document = buildJsonApi(ReportingFrameworkDto);

      const result = await service.addDto(document, framework);
      const serialized = result.serialize();

      expect(result).toBe(document);
      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe(framework.slug);
      expect(
        (serialized.data as unknown as { attributes: { totalProjectsCount: number } }).attributes.totalProjectsCount
      ).toBe(5);
    });

    it("should handle null form UUIDs", async () => {
      const framework = await FrameworkFactory.create({
        slug: "enterprises",
        projectFormUuid: null,
        siteFormUuid: null,
        nurseryFormUuid: null
      });
      createdFrameworkIds.push(framework.id);
      const document = buildJsonApi(ReportingFrameworkDto);

      const result = await service.addDto(document, framework);
      const serialized = result.serialize();

      const attributes = (
        serialized.data as unknown as {
          attributes: {
            projectFormUuid: string | null;
            siteFormUuid: string | null;
            nurseryFormUuid: string | null;
          };
        }
      ).attributes;
      expect(attributes.projectFormUuid).toBeNull();
      expect(attributes.siteFormUuid).toBeNull();
      expect(attributes.nurseryFormUuid).toBeNull();
    });

    it("should use uuid as id when slug is null", async () => {
      const framework = await FrameworkFactory.create({ slug: null });
      createdFrameworkIds.push(framework.id);
      const document = buildJsonApi(ReportingFrameworkDto);

      const result = await service.addDto(document, framework);

      expect(result.data[0].id).toBe(framework.uuid);
    });
  });

  describe("addDtos", () => {
    it("should add multiple framework dtos to document", async () => {
      const frameworks = await Promise.all([
        FrameworkFactory.create({ slug: "terrafund" }),
        FrameworkFactory.create({ slug: "ppc" }),
        FrameworkFactory.create({ slug: "hbf" })
      ]);
      createdFrameworkIds.push(...frameworks.map(f => f.id));
      await ProjectFactory.createMany(2, { frameworkKey: frameworks[0].slug });
      await ProjectFactory.createMany(4, { frameworkKey: frameworks[1].slug });
      const document = buildJsonApi(ReportingFrameworkDto, { forceDataArray: true });

      const result = await service.addDtos(document, frameworks);
      const serialized = result.serialize();

      expect(result).toBe(document);
      expect(result.data).toHaveLength(3);
      const dataArray = serialized.data as unknown as Array<{ attributes: { totalProjectsCount: number } }>;
      expect(dataArray[0].attributes.totalProjectsCount).toBe(2);
      expect(dataArray[1].attributes.totalProjectsCount).toBe(4);
      expect(dataArray[2].attributes.totalProjectsCount).toBe(0);
    });

    it("should handle empty frameworks array", async () => {
      const document = buildJsonApi(ReportingFrameworkDto, { forceDataArray: true });

      const result = await service.addDtos(document, []);

      expect(result).toBe(document);
      expect(result.data).toHaveLength(0);
    });

    it("should use uuid as id when slug is null", async () => {
      const frameworks = await Promise.all([
        FrameworkFactory.create({ slug: null }),
        FrameworkFactory.create({ slug: "terrafund" })
      ]);
      createdFrameworkIds.push(...frameworks.map(f => f.id));
      const document = buildJsonApi(ReportingFrameworkDto, { forceDataArray: true });

      const result = await service.addDtos(document, frameworks);

      expect(result.data[0].id).toBe(frameworks[0].uuid);
      expect(result.data[1].id).toBe(frameworks[1].slug);
    });
  });
});

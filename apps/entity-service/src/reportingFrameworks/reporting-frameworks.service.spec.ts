import { Test, TestingModule } from "@nestjs/testing";
import { ReportingFrameworksService } from "./reporting-frameworks.service";
import { Framework, Form, Project, FrameworkUser } from "@terramatch-microservices/database/entities";
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

  describe("findByUuid", () => {
    it("should return a framework by uuid", async () => {
      const framework = await FrameworkFactory.create({ slug: "terrafund" });
      createdFrameworkIds.push(framework.id);

      const result = await service.findByUuid(framework.uuid as string);

      expect(result).toBeInstanceOf(Framework);
      expect(result.uuid).toBe(framework.uuid);
      expect(result.slug).toBe("terrafund");
    });

    it("should throw NotFoundException for invalid uuid", async () => {
      await expect(service.findByUuid("00000000-0000-0000-0000-000000000000")).rejects.toThrow(NotFoundException);
      await expect(service.findByUuid("00000000-0000-0000-0000-000000000000")).rejects.toThrow(
        "Reporting framework not found"
      );
    });
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

    it("should add framework dto with all form UUIDs populated", async () => {
      const framework = await FrameworkFactory.create({
        slug: "terrafund",
        projectFormUuid: "project-form-uuid",
        projectReportFormUuid: "project-report-form-uuid",
        siteFormUuid: "site-form-uuid",
        siteReportFormUuid: "site-report-form-uuid",
        nurseryFormUuid: "nursery-form-uuid",
        nurseryReportFormUuid: "nursery-report-form-uuid"
      });
      createdFrameworkIds.push(framework.id);
      const document = buildJsonApi(ReportingFrameworkDto);

      const result = await service.addDto(document, framework);
      const serialized = result.serialize();

      const attributes = (
        serialized.data as unknown as {
          attributes: {
            projectFormUuid: string | null;
            projectReportFormUuid: string | null;
            siteFormUuid: string | null;
            siteReportFormUuid: string | null;
            nurseryFormUuid: string | null;
            nurseryReportFormUuid: string | null;
          };
        }
      ).attributes;
      expect(attributes.projectFormUuid).toBe("project-form-uuid");
      expect(attributes.projectReportFormUuid).toBe("project-report-form-uuid");
      expect(attributes.siteFormUuid).toBe("site-form-uuid");
      expect(attributes.siteReportFormUuid).toBe("site-report-form-uuid");
      expect(attributes.nurseryFormUuid).toBe("nursery-form-uuid");
      expect(attributes.nurseryReportFormUuid).toBe("nursery-report-form-uuid");
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

    it("should handle frameworks with mixed form UUIDs", async () => {
      const frameworks = await Promise.all([
        FrameworkFactory.create({
          slug: "terrafund",
          projectFormUuid: "project-form-1",
          projectReportFormUuid: null,
          siteFormUuid: null,
          siteReportFormUuid: "site-report-1",
          nurseryFormUuid: null,
          nurseryReportFormUuid: null
        }),
        FrameworkFactory.create({
          slug: "ppc",
          projectFormUuid: null,
          projectReportFormUuid: null,
          siteFormUuid: null,
          siteReportFormUuid: null,
          nurseryFormUuid: null,
          nurseryReportFormUuid: null
        })
      ]);
      createdFrameworkIds.push(...frameworks.map(f => f.id));
      const document = buildJsonApi(ReportingFrameworkDto, { forceDataArray: true });

      const result = await service.addDtos(document, frameworks);
      const serialized = result.serialize();

      expect(result.data).toHaveLength(2);
      const dataArray = serialized.data as unknown as Array<{
        attributes: {
          projectFormUuid: string | null;
          projectReportFormUuid: string | null;
          siteFormUuid: string | null;
          siteReportFormUuid: string | null;
        };
      }>;
      expect(dataArray[0].attributes.projectFormUuid).toBe("project-form-1");
      expect(dataArray[0].attributes.projectReportFormUuid).toBeNull();
      expect(dataArray[0].attributes.siteFormUuid).toBeNull();
      expect(dataArray[0].attributes.siteReportFormUuid).toBe("site-report-1");
      expect(dataArray[1].attributes.projectFormUuid).toBeNull();
    });
  });

  describe("create", () => {
    it("should create framework with slug from name and call syncForms", async () => {
      const attributes = {
        name: "My New Framework",
        accessCode: null as string | null,
        projectFormUuid: null as string | null,
        projectReportFormUuid: null as string | null,
        financialReportFormUuid: null as string | null,
        siteFormUuid: null as string | null,
        siteReportFormUuid: null as string | null,
        nurseryFormUuid: null as string | null,
        nurseryReportFormUuid: null as string | null
      };
      const createdFramework = {
        id: 1,
        uuid: "framework-uuid",
        slug: "my-new-framework",
        ...attributes
      } as unknown as Framework;

      const formUpdateSpy = jest.spyOn(Form, "update").mockResolvedValue([1]);
      const createSpy = jest.spyOn(Framework, "create").mockResolvedValue(createdFramework);

      const result = await service.create(attributes);

      expect(createSpy).toHaveBeenCalledWith({
        name: attributes.name,
        slug: "my-new-framework",
        accessCode: null,
        projectFormUuid: null,
        projectReportFormUuid: null,
        financialReportFormUuid: null,
        siteFormUuid: null,
        siteReportFormUuid: null,
        nurseryFormUuid: null,
        nurseryReportFormUuid: null
      });
      expect(result).toEqual(createdFramework);
      expect(formUpdateSpy).toHaveBeenCalled();
    });
  });

  describe("update", () => {
    it("should update framework when payload has attributes", async () => {
      const framework = await FrameworkFactory.create({ slug: "terrafund", name: "TerraFund" });
      createdFrameworkIds.push(framework.id);
      const updateSpy = jest.spyOn(framework, "update").mockResolvedValue(framework);
      jest.spyOn(Form, "update").mockResolvedValue([1]);

      const result = await service.update(framework, { name: "TerraFund Updated" });

      expect(updateSpy).toHaveBeenCalledWith({ name: "TerraFund Updated" });
      expect(result).toBe(framework);
    });

    it("should not call framework.update when payload is empty", async () => {
      const framework = await FrameworkFactory.create({ slug: "terrafund" });
      createdFrameworkIds.push(framework.id);
      const updateSpy = jest.spyOn(framework, "update");
      jest.spyOn(Form, "update").mockResolvedValue([1]);

      await service.update(framework, {});

      expect(updateSpy).not.toHaveBeenCalled();
    });

    it("should not call syncFormsForFramework when framework slug is null", async () => {
      const framework = await FrameworkFactory.create({ slug: null, name: "Null Slug" });
      createdFrameworkIds.push(framework.id);
      const formUpdateSpy = jest.spyOn(Form, "update");

      await service.update(framework, { name: "Updated Name" });

      expect(formUpdateSpy).not.toHaveBeenCalled();
    });

    it("should update form UUIDs and call syncFormsForFramework", async () => {
      const framework = await FrameworkFactory.create({
        slug: "ppc",
        projectFormUuid: "old-uuid",
        siteFormUuid: null
      });
      createdFrameworkIds.push(framework.id);
      jest.spyOn(framework, "update").mockResolvedValue({ ...framework, siteFormUuid: "new-site-uuid" } as Framework);
      const formUpdateSpy = jest.spyOn(Form, "update").mockResolvedValue([1]);

      await service.update(framework, { siteFormUuid: "new-site-uuid" });

      expect(formUpdateSpy).toHaveBeenCalled();
    });
  });

  describe("delete", () => {
    it("should detach forms and destroy framework (permissions left to permissions.ts + sync)", async () => {
      const framework = await FrameworkFactory.create({
        slug: "terrafund",
        name: "TerraFund",
        projectFormUuid: "form-uuid-1",
        siteFormUuid: null
      });
      createdFrameworkIds.push(framework.id);
      const formUpdateSpy = jest.spyOn(Form, "update").mockResolvedValue([1]);
      const destroyFrameworkSpy = jest.spyOn(framework, "destroy").mockResolvedValue(undefined);

      await service.delete(framework);

      expect(formUpdateSpy).toHaveBeenCalledWith(
        { frameworkKey: null, model: null },
        { where: { uuid: "form-uuid-1" } }
      );
      expect(destroyFrameworkSpy).toHaveBeenCalled();
    });

    it("should skip Form.update when framework has no form UUIDs", async () => {
      const framework = await FrameworkFactory.create({
        slug: "terrafund",
        projectFormUuid: null,
        projectReportFormUuid: null,
        siteFormUuid: null,
        siteReportFormUuid: null,
        nurseryFormUuid: null,
        nurseryReportFormUuid: null
      });
      createdFrameworkIds.push(framework.id);
      const formUpdateSpy = jest.spyOn(Form, "update");
      jest.spyOn(framework, "destroy").mockResolvedValue(undefined);

      await service.delete(framework);

      expect(formUpdateSpy).not.toHaveBeenCalled();
    });
  });

  describe("syncFormsForFramework", () => {
    it("should attach forms by UUID and detach others for the slug", async () => {
      const formUpdateSpy = jest.spyOn(Form, "update").mockResolvedValue([1]);

      await service.syncFormsForFramework("terrafund", {
        projectFormUuid: "project-form-uuid",
        projectReportFormUuid: null,
        siteFormUuid: "site-form-uuid",
        siteReportFormUuid: null,
        nurseryFormUuid: null,
        nurseryReportFormUuid: null
      });

      expect(formUpdateSpy).toHaveBeenCalledWith(
        { frameworkKey: "terrafund", model: expect.any(String) },
        { where: { uuid: "project-form-uuid" } }
      );
      expect(formUpdateSpy).toHaveBeenCalledWith(
        { frameworkKey: "terrafund", model: expect.any(String) },
        { where: { uuid: "site-form-uuid" } }
      );
      const detachCall = formUpdateSpy.mock.calls.find(
        call =>
          call[0]?.frameworkKey === null &&
          call[1]?.where != null &&
          "uuid" in (call[1].where as Record<string, unknown>)
      );
      expect(detachCall).toBeDefined();
      expect(detachCall?.[1].where).toMatchObject({
        frameworkKey: "terrafund",
        uuid: expect.anything()
      });
    });

    it("should detach all forms for slug when no current UUIDs", async () => {
      const formUpdateSpy = jest.spyOn(Form, "update").mockResolvedValue([1]);

      await service.syncFormsForFramework("ppc", {
        projectFormUuid: null,
        projectReportFormUuid: null,
        siteFormUuid: null,
        siteReportFormUuid: null,
        nurseryFormUuid: null,
        nurseryReportFormUuid: null
      });

      const detachCall = formUpdateSpy.mock.calls.find(
        call => call[1]?.where != null && (call[1].where as { uuid?: unknown }).uuid === undefined
      );
      expect(detachCall).toBeDefined();
      expect(detachCall?.[1].where).toEqual({ frameworkKey: "ppc" });
    });
  });
});

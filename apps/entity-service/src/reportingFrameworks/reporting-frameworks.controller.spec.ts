import { Test, TestingModule } from "@nestjs/testing";
import { ReportingFrameworksController } from "./reporting-frameworks.controller";
import { ReportingFrameworksService } from "./reporting-frameworks.service";
import { PolicyService } from "@terramatch-microservices/common";
import { NotFoundException, UnauthorizedException } from "@nestjs/common";
import { FrameworkFactory, ProjectFactory } from "@terramatch-microservices/database/factories";
import { mockPermissions, mockUserId } from "@terramatch-microservices/common/util/testing";

describe("ReportingFrameworksController", () => {
  let controller: ReportingFrameworksController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReportingFrameworksController],
      providers: [ReportingFrameworksService, PolicyService]
    }).compile();

    controller = module.get<ReportingFrameworksController>(ReportingFrameworksController);

    mockUserId(1);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("index", () => {
    it("should return all frameworks for admin users", async () => {
      mockPermissions("framework-terrafund");
      const frameworks = await Promise.all([
        FrameworkFactory.create({ slug: "terrafund" }),
        FrameworkFactory.create({ slug: "ppc" }),
        FrameworkFactory.create({ slug: "hbf" })
      ]);
      await ProjectFactory.create({ frameworkKey: frameworks[0].slug });
      await ProjectFactory.create({ frameworkKey: frameworks[0].slug });
      await ProjectFactory.create({ frameworkKey: frameworks[1].slug });

      const document = await controller.index({});
      const result = document.serialize();

      expect(result.data as unknown as Array<{ id: string }>).toHaveLength(3);
      expect((result.data as unknown as Array<{ id: string }>)[0].id).toBe(frameworks[0].uuid);
      expect(
        (result.data as unknown as Array<{ attributes: { totalProjectsCount: number } }>)[0].attributes
          .totalProjectsCount
      ).toBe(2);
      expect(
        (result.data as unknown as Array<{ attributes: { totalProjectsCount: number } }>)[1].attributes
          .totalProjectsCount
      ).toBe(1);
      expect(
        (result.data as unknown as Array<{ attributes: { totalProjectsCount: number } }>)[2].attributes
          .totalProjectsCount
      ).toBe(0);
    });

    it("should throw UnauthorizedException for non-admin users", async () => {
      mockPermissions();
      await FrameworkFactory.createMany(3);

      await expect(controller.index({})).rejects.toThrow(UnauthorizedException);
    });

    it("should include all form UUIDs in response", async () => {
      mockPermissions("framework-ppc");
      await FrameworkFactory.create({
        slug: "ppc",
        projectFormUuid: "project-form-uuid",
        projectReportFormUuid: "project-report-form-uuid",
        siteFormUuid: "site-form-uuid",
        siteReportFormUuid: "site-report-form-uuid",
        nurseryFormUuid: "nursery-form-uuid",
        nurseryReportFormUuid: "nursery-report-form-uuid"
      });

      const document = await controller.index({});
      const result = document.serialize();

      const firstItem = (
        result.data as unknown as Array<{
          attributes: {
            projectFormUuid: string;
            projectReportFormUuid: string;
            siteFormUuid: string;
            siteReportFormUuid: string;
            nurseryFormUuid: string;
            nurseryReportFormUuid: string;
          };
        }>
      )[0].attributes;
      expect(firstItem.projectFormUuid).toBe("project-form-uuid");
      expect(firstItem.projectReportFormUuid).toBe("project-report-form-uuid");
      expect(firstItem.siteFormUuid).toBe("site-form-uuid");
      expect(firstItem.siteReportFormUuid).toBe("site-report-form-uuid");
      expect(firstItem.nurseryFormUuid).toBe("nursery-form-uuid");
      expect(firstItem.nurseryReportFormUuid).toBe("nursery-report-form-uuid");
    });
  });

  describe("get", () => {
    it("should return a framework by slug for authenticated users", async () => {
      mockPermissions("manage-own");
      const framework = await FrameworkFactory.create({ slug: "terrafund" });
      await ProjectFactory.createMany(5, { frameworkKey: framework.slug });

      const document = await controller.get("terrafund");
      const result = document.serialize();

      expect((result.data as unknown as { id: string }).id).toBe(framework.uuid);
      expect((result.data as unknown as { attributes: { slug: string } }).attributes.slug).toBe("terrafund");
      expect(
        (result.data as unknown as { attributes: { totalProjectsCount: number } }).attributes.totalProjectsCount
      ).toBe(5);
    });

    it("should throw NotFoundException for invalid slug", async () => {
      mockPermissions("manage-own");

      await expect(controller.get("non-existent")).rejects.toThrow(NotFoundException);
    });

    it("should return framework with accessCode matching slug", async () => {
      mockPermissions("manage-own");
      await FrameworkFactory.create({
        slug: "enterprises",
        accessCode: "enterprises"
      });

      const document = await controller.get("enterprises");
      const result = document.serialize();

      expect((result.data as unknown as { attributes: { slug: string } }).attributes.slug).toBe("enterprises");
      expect((result.data as unknown as { attributes: { accessCode: string } }).attributes.accessCode).toBe(
        "enterprises"
      );
    });

    it("should work for admin users", async () => {
      mockPermissions("framework-terrafund");
      await FrameworkFactory.create({ slug: "terrafund" });

      const document = await controller.get("terrafund");
      const result = document.serialize();

      expect((result.data as unknown as { attributes: { slug: string } }).attributes.slug).toBe("terrafund");
    });

    it("should include null form UUIDs correctly", async () => {
      mockPermissions("manage-own");
      await FrameworkFactory.create({
        slug: "fundo-flora",
        projectFormUuid: null,
        projectReportFormUuid: null,
        siteFormUuid: null,
        siteReportFormUuid: null,
        nurseryFormUuid: null,
        nurseryReportFormUuid: null
      });

      const document = await controller.get("fundo-flora");
      const result = document.serialize();

      const attributes = (
        result.data as unknown as {
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
      expect(attributes.projectFormUuid).toBeNull();
      expect(attributes.projectReportFormUuid).toBeNull();
      expect(attributes.siteFormUuid).toBeNull();
      expect(attributes.siteReportFormUuid).toBeNull();
      expect(attributes.nurseryFormUuid).toBeNull();
      expect(attributes.nurseryReportFormUuid).toBeNull();
    });
  });
});

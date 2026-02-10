import { createMock, DeepMocked } from "@golevelup/ts-jest";
import { Test, TestingModule } from "@nestjs/testing";
import { ReportingFrameworksController } from "./reporting-frameworks.controller";
import { ReportingFrameworksService } from "./reporting-frameworks.service";
import { PolicyService } from "@terramatch-microservices/common";
import { NotFoundException, UnauthorizedException } from "@nestjs/common";
import { FrameworkFactory, ProjectFactory } from "@terramatch-microservices/database/factories";
import { mockUserId } from "@terramatch-microservices/common/util/testing";
import { DocumentBuilder } from "@terramatch-microservices/common/util";
import { Project, Framework, FrameworkUser } from "@terramatch-microservices/database/entities";

describe("ReportingFrameworksController", () => {
  let controller: ReportingFrameworksController;
  let reportingFrameworksService: DeepMocked<ReportingFrameworksService>;
  let policyService: DeepMocked<PolicyService>;
  const createdFrameworkIds: number[] = [];

  beforeEach(async () => {
    try {
      await Project.truncate({ cascade: true });
    } catch {
      await Project.destroy({ where: {}, force: true });
    }

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReportingFrameworksController],
      providers: [
        {
          provide: ReportingFrameworksService,
          useValue: (reportingFrameworksService = createMock<ReportingFrameworksService>())
        },
        { provide: PolicyService, useValue: (policyService = createMock<PolicyService>()) }
      ]
    }).compile();

    controller = module.get<ReportingFrameworksController>(ReportingFrameworksController);

    mockUserId(1);
    createdFrameworkIds.length = 0;
  });

  afterEach(async () => {
    if (createdFrameworkIds.length > 0) {
      await FrameworkUser.destroy({ where: { frameworkId: createdFrameworkIds }, force: true });
      await Framework.destroy({ where: { id: createdFrameworkIds }, force: true });
    }
    try {
      await Project.truncate({ cascade: true });
    } catch {
      await Project.destroy({ where: {}, force: true });
    }
    jest.restoreAllMocks();
  });

  describe("index", () => {
    it("should return all frameworks for admin users", async () => {
      const frameworks = await Promise.all([
        FrameworkFactory.create({ slug: "terrafund" }),
        FrameworkFactory.create({ slug: "ppc" }),
        FrameworkFactory.create({ slug: "hbf" })
      ]);
      createdFrameworkIds.push(...frameworks.map(f => f.id));
      await ProjectFactory.create({ frameworkKey: frameworks[0].slug });
      await ProjectFactory.create({ frameworkKey: frameworks[0].slug });
      await ProjectFactory.create({ frameworkKey: frameworks[1].slug });

      reportingFrameworksService.findAll.mockResolvedValue(frameworks);
      policyService.authorize.mockResolvedValue(undefined);
      const mockDocument = createMock<DocumentBuilder>();
      mockDocument.serialize.mockReturnValue({ data: [], meta: { resourceType: "reportingFrameworks" } } as never);
      reportingFrameworksService.addDtos.mockResolvedValue(mockDocument);

      await controller.index({});

      expect(reportingFrameworksService.findAll).toHaveBeenCalled();
      expect(policyService.authorize).toHaveBeenCalledWith("read", frameworks);
      expect(reportingFrameworksService.addDtos).toHaveBeenCalled();
    });

    it("should throw UnauthorizedException for non-admin users", async () => {
      const frameworks = await Promise.all([
        FrameworkFactory.create({ slug: "terrafund" }),
        FrameworkFactory.create({ slug: "ppc" })
      ]);
      createdFrameworkIds.push(...frameworks.map(f => f.id));

      reportingFrameworksService.findAll.mockResolvedValue(frameworks);
      policyService.authorize.mockRejectedValue(new UnauthorizedException("Not authorized"));

      await expect(controller.index({})).rejects.toThrow(UnauthorizedException);
      expect(reportingFrameworksService.findAll).toHaveBeenCalled();
      expect(policyService.authorize).toHaveBeenCalledWith("read", frameworks);
      expect(reportingFrameworksService.addDtos).not.toHaveBeenCalled();
    });

    it("should include all form UUIDs in response", async () => {
      const framework = await FrameworkFactory.create({
        slug: "ppc",
        projectFormUuid: "project-form-uuid",
        projectReportFormUuid: "project-report-form-uuid",
        siteFormUuid: "site-form-uuid",
        siteReportFormUuid: "site-report-form-uuid",
        nurseryFormUuid: "nursery-form-uuid",
        nurseryReportFormUuid: "nursery-report-form-uuid"
      });
      createdFrameworkIds.push(framework.id);

      reportingFrameworksService.findAll.mockResolvedValue([framework]);
      policyService.authorize.mockResolvedValue(undefined);
      const mockDocument = createMock<DocumentBuilder>();
      mockDocument.serialize.mockReturnValue({
        data: [
          {
            attributes: {
              projectFormUuid: "project-form-uuid",
              projectReportFormUuid: "project-report-form-uuid",
              siteFormUuid: "site-form-uuid",
              siteReportFormUuid: "site-report-form-uuid",
              nurseryFormUuid: "nursery-form-uuid",
              nurseryReportFormUuid: "nursery-report-form-uuid"
            }
          }
        ]
      } as never);
      reportingFrameworksService.addDtos.mockResolvedValue(mockDocument);

      const document = await controller.index({});
      const result = document.serialize();

      const dataArray = result.data as unknown as Array<{
        attributes: {
          projectFormUuid: string;
          projectReportFormUuid: string;
          siteFormUuid: string;
          siteReportFormUuid: string;
          nurseryFormUuid: string;
          nurseryReportFormUuid: string;
        };
      }>;
      expect(dataArray[0]?.attributes.projectFormUuid).toBe("project-form-uuid");
      expect(dataArray[0]?.attributes.projectReportFormUuid).toBe("project-report-form-uuid");
      expect(dataArray[0]?.attributes.siteFormUuid).toBe("site-form-uuid");
      expect(dataArray[0]?.attributes.siteReportFormUuid).toBe("site-report-form-uuid");
      expect(dataArray[0]?.attributes.nurseryFormUuid).toBe("nursery-form-uuid");
      expect(dataArray[0]?.attributes.nurseryReportFormUuid).toBe("nursery-report-form-uuid");
    });

    it("should throw UnauthorizedException when authorize fails", async () => {
      const frameworks = await Promise.all([
        FrameworkFactory.create({ slug: "terrafund" }),
        FrameworkFactory.create({ slug: "ppc" })
      ]);
      createdFrameworkIds.push(...frameworks.map(f => f.id));

      reportingFrameworksService.findAll.mockResolvedValue(frameworks);
      policyService.authorize.mockRejectedValue(new UnauthorizedException("Not authorized"));

      await expect(controller.index({})).rejects.toThrow(UnauthorizedException);
      expect(reportingFrameworksService.findAll).toHaveBeenCalled();
      expect(policyService.authorize).toHaveBeenCalledWith("read", frameworks);
      expect(reportingFrameworksService.addDtos).not.toHaveBeenCalled();
    });

    it("should handle query parameters correctly", async () => {
      const frameworks = await Promise.all([FrameworkFactory.create({ slug: "terrafund" })]);
      createdFrameworkIds.push(...frameworks.map(f => f.id));

      reportingFrameworksService.findAll.mockResolvedValue(frameworks);
      policyService.authorize.mockResolvedValue(undefined);
      const mockDocument = createMock<DocumentBuilder>();
      mockDocument.serialize.mockReturnValue({ data: [], meta: { resourceType: "reportingFrameworks" } } as never);
      reportingFrameworksService.addDtos.mockResolvedValue(mockDocument);

      const query = { translated: true };
      await controller.index(query);

      expect(reportingFrameworksService.findAll).toHaveBeenCalled();
      expect(policyService.authorize).toHaveBeenCalledWith("read", frameworks);
      expect(reportingFrameworksService.addDtos).toHaveBeenCalled();
    });

    it("should handle empty frameworks array", async () => {
      reportingFrameworksService.findAll.mockResolvedValue([]);
      policyService.authorize.mockResolvedValue(undefined);
      const mockDocument = createMock<DocumentBuilder>();
      mockDocument.serialize.mockReturnValue({ data: [], meta: { resourceType: "reportingFrameworks" } } as never);
      reportingFrameworksService.addDtos.mockResolvedValue(mockDocument);

      await controller.index({});

      expect(reportingFrameworksService.findAll).toHaveBeenCalled();
      expect(policyService.authorize).toHaveBeenCalledWith("read", []);
      expect(reportingFrameworksService.addDtos).toHaveBeenCalledWith(expect.any(Object), []);
      const callArgs = reportingFrameworksService.addDtos.mock.calls[0];
      expect(callArgs[0]).toHaveProperty("resourceType", "reportingFrameworks");
      expect(callArgs[0]).toHaveProperty("options.forceDataArray", true);
    });
  });

  describe("get", () => {
    it("should return a framework by slug for authenticated users", async () => {
      const framework = await FrameworkFactory.create({ slug: "terrafund" });
      createdFrameworkIds.push(framework.id);
      await ProjectFactory.createMany(5, { frameworkKey: framework.slug });

      reportingFrameworksService.findBySlug.mockResolvedValue(framework);
      policyService.authorize.mockResolvedValue(undefined);
      const mockDocument = createMock<DocumentBuilder>();
      mockDocument.serialize.mockReturnValue({
        data: {
          id: "terrafund",
          attributes: {
            slug: "terrafund",
            totalProjectsCount: 5
          }
        }
      } as never);
      reportingFrameworksService.addDto.mockResolvedValue(mockDocument);

      const document = await controller.get("terrafund");
      const result = document.serialize();

      expect(reportingFrameworksService.findBySlug).toHaveBeenCalledWith("terrafund");
      expect(policyService.authorize).toHaveBeenCalledWith("read", framework);
      expect(reportingFrameworksService.addDto).toHaveBeenCalled();
      const data = result.data as unknown as { id: string; attributes: { slug: string; totalProjectsCount: number } };
      expect(data.id).toBe("terrafund");
      expect(data.attributes.slug).toBe("terrafund");
      expect(data.attributes.totalProjectsCount).toBe(5);
    });

    it("should throw NotFoundException for invalid slug", async () => {
      reportingFrameworksService.findBySlug.mockRejectedValue(new NotFoundException("Reporting framework not found"));

      await expect(controller.get("non-existent")).rejects.toThrow(NotFoundException);
      expect(reportingFrameworksService.findBySlug).toHaveBeenCalledWith("non-existent");
    });

    it("should return framework with slug as id", async () => {
      const framework = await FrameworkFactory.create({
        slug: "enterprises"
      });
      createdFrameworkIds.push(framework.id);

      reportingFrameworksService.findBySlug.mockResolvedValue(framework);
      policyService.authorize.mockResolvedValue(undefined);
      const mockDocument = createMock<DocumentBuilder>();
      mockDocument.serialize.mockReturnValue({
        data: {
          id: "enterprises",
          attributes: {
            slug: "enterprises"
          }
        }
      } as never);
      reportingFrameworksService.addDto.mockResolvedValue(mockDocument);

      const document = await controller.get("enterprises");
      const result = document.serialize();

      const data = result.data as unknown as { id: string; attributes: { slug: string } };
      expect(data.id).toBe("enterprises");
      expect(data.attributes.slug).toBe("enterprises");
    });

    it("should work for admin users", async () => {
      const framework = await FrameworkFactory.create({ slug: "terrafund" });
      createdFrameworkIds.push(framework.id);

      reportingFrameworksService.findBySlug.mockResolvedValue(framework);
      policyService.authorize.mockResolvedValue(undefined);
      const mockDocument = createMock<DocumentBuilder>();
      mockDocument.serialize.mockReturnValue({
        data: {
          attributes: {
            slug: "terrafund"
          }
        }
      } as never);
      reportingFrameworksService.addDto.mockResolvedValue(mockDocument);

      const document = await controller.get("terrafund");
      const result = document.serialize();

      const data = result.data as unknown as { attributes: { slug: string } };
      expect(data.attributes.slug).toBe("terrafund");
    });

    it("should include null form UUIDs correctly", async () => {
      const framework = await FrameworkFactory.create({
        slug: "fundo-flora",
        projectFormUuid: null,
        projectReportFormUuid: null,
        siteFormUuid: null,
        siteReportFormUuid: null,
        nurseryFormUuid: null,
        nurseryReportFormUuid: null
      });
      createdFrameworkIds.push(framework.id);

      reportingFrameworksService.findBySlug.mockResolvedValue(framework);
      policyService.authorize.mockResolvedValue(undefined);
      const mockDocument = createMock<DocumentBuilder>();
      mockDocument.serialize.mockReturnValue({
        data: {
          attributes: {
            projectFormUuid: null,
            projectReportFormUuid: null,
            siteFormUuid: null,
            siteReportFormUuid: null,
            nurseryFormUuid: null,
            nurseryReportFormUuid: null
          }
        }
      } as never);
      reportingFrameworksService.addDto.mockResolvedValue(mockDocument);

      const document = await controller.get("fundo-flora");
      const result = document.serialize();

      const data = result.data as unknown as {
        attributes: {
          projectFormUuid: string | null;
          projectReportFormUuid: string | null;
          siteFormUuid: string | null;
          siteReportFormUuid: string | null;
          nurseryFormUuid: string | null;
          nurseryReportFormUuid: string | null;
        };
      };
      expect(data.attributes.projectFormUuid).toBeNull();
      expect(data.attributes.projectReportFormUuid).toBeNull();
      expect(data.attributes.siteFormUuid).toBeNull();
      expect(data.attributes.siteReportFormUuid).toBeNull();
      expect(data.attributes.nurseryFormUuid).toBeNull();
      expect(data.attributes.nurseryReportFormUuid).toBeNull();
    });

    it("should throw UnauthorizedException when authorize fails", async () => {
      const framework = await FrameworkFactory.create({ slug: "terrafund" });
      createdFrameworkIds.push(framework.id);

      reportingFrameworksService.findBySlug.mockResolvedValue(framework);
      policyService.authorize.mockRejectedValue(new UnauthorizedException("Not authorized"));

      await expect(controller.get("terrafund")).rejects.toThrow(UnauthorizedException);
      expect(reportingFrameworksService.findBySlug).toHaveBeenCalledWith("terrafund");
      expect(policyService.authorize).toHaveBeenCalledWith("read", framework);
      expect(reportingFrameworksService.addDto).not.toHaveBeenCalled();
    });

    it("should handle framework with zero projects count", async () => {
      const framework = await FrameworkFactory.create({ slug: "fundo-flora" });
      createdFrameworkIds.push(framework.id);

      reportingFrameworksService.findBySlug.mockResolvedValue(framework);
      policyService.authorize.mockResolvedValue(undefined);
      const mockDocument = createMock<DocumentBuilder>();
      mockDocument.serialize.mockReturnValue({
        data: {
          id: "fundo-flora",
          attributes: {
            slug: "fundo-flora",
            totalProjectsCount: 0
          }
        }
      } as never);
      reportingFrameworksService.addDto.mockResolvedValue(mockDocument);

      const document = await controller.get("fundo-flora");
      const result = document.serialize();

      expect(reportingFrameworksService.findBySlug).toHaveBeenCalledWith("fundo-flora");
      expect(policyService.authorize).toHaveBeenCalledWith("read", framework);
      const data = result.data as unknown as { id: string; attributes: { slug: string; totalProjectsCount: number } };
      expect(data.attributes.totalProjectsCount).toBe(0);
    });

    it("should handle error when findAll throws", async () => {
      const error = new Error("Database error");
      reportingFrameworksService.findAll.mockRejectedValue(error);

      await expect(controller.index({})).rejects.toThrow("Database error");
      expect(reportingFrameworksService.findAll).toHaveBeenCalled();
      expect(policyService.authorize).not.toHaveBeenCalled();
    });

    it("should handle error when addDtos throws", async () => {
      const frameworks = await Promise.all([FrameworkFactory.create({ slug: "terrafund" })]);
      createdFrameworkIds.push(...frameworks.map(f => f.id));

      reportingFrameworksService.findAll.mockResolvedValue(frameworks);
      policyService.authorize.mockResolvedValue(undefined);
      const error = new Error("Serialization error");
      reportingFrameworksService.addDtos.mockRejectedValue(error);

      await expect(controller.index({})).rejects.toThrow("Serialization error");
      expect(reportingFrameworksService.findAll).toHaveBeenCalled();
      expect(policyService.authorize).toHaveBeenCalledWith("read", frameworks);
      expect(reportingFrameworksService.addDtos).toHaveBeenCalled();
    });

    it("should handle error when addDto throws", async () => {
      const framework = await FrameworkFactory.create({ slug: "terrafund" });
      createdFrameworkIds.push(framework.id);

      reportingFrameworksService.findBySlug.mockResolvedValue(framework);
      policyService.authorize.mockResolvedValue(undefined);
      const error = new Error("Serialization error");
      reportingFrameworksService.addDto.mockRejectedValue(error);

      await expect(controller.get("terrafund")).rejects.toThrow("Serialization error");
      expect(reportingFrameworksService.findBySlug).toHaveBeenCalledWith("terrafund");
      expect(policyService.authorize).toHaveBeenCalledWith("read", framework);
      expect(reportingFrameworksService.addDto).toHaveBeenCalled();
    });
  });
});
